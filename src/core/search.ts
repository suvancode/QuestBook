import { Question, QuestionPriority, QuestionStatus, SourceType } from '../types/questbook';

export type SortOrder = 'newest' | 'oldest' | 'updated' | 'priority' | 'researched';

export interface QuestionSearchFilters {
  query?: string;
  categoryId?: string;
  tagIds?: string[]; // Question must have at least one matching tag when non-empty
  questionTagMap?: Map<string, Set<string>>;
  tagNameMap?: Map<string, string>;
  categoryNameMap?: Map<string, string>;
  status?: QuestionStatus | 'all';
  priority?: QuestionPriority | 'all';
  sourceType?: SourceType | 'all';
  dateFrom?: number | null;
  dateTo?: number | null;
  favoritesOnly?: boolean;
  includeArchived?: boolean;
  includeDeleted?: boolean;
  sortBy?: SortOrder;
}

export interface SemanticSearchExtension {
  name: string;
  enabled: boolean;
  rankRelatedQuestions(query: string, questions: Question[]): Promise<Array<{ questionId: string; score: number }>>;
}

// Disabled by default until user configures an external or local embedding provider
export const defaultSemanticSearchStub: SemanticSearchExtension = {
  name: 'Disabled (Local Keyword Mode)',
  enabled: false,
  async rankRelatedQuestions() {
    return [];
  },
};

const PRIORITY_WEIGHT: Record<QuestionPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function searchAndFilterQuestions(questions: Question[], filters: QuestionSearchFilters): Question[] {
  const q = (filters.query ?? '').trim().toLowerCase();

  const filtered = questions.filter((item) => {
    if (!filters.includeDeleted && item.deletedAt !== null) return false;
    if (filters.includeDeleted && item.deletedAt === null) return false;
    if (!filters.includeArchived && item.archivedAt !== null && !filters.includeDeleted) return false;

    if (filters.categoryId && filters.categoryId !== 'all' && item.categoryId !== filters.categoryId) {
      return false;
    }
    if (filters.status && filters.status !== 'all' && item.status !== filters.status) {
      return false;
    }
    if (filters.priority && filters.priority !== 'all' && item.priority !== filters.priority) {
      return false;
    }
    if (filters.sourceType && filters.sourceType !== 'all' && item.sourceType !== filters.sourceType) {
      return false;
    }
    if (filters.favoritesOnly && !item.isFavorite && !item.isPinned) {
      return false;
    }
    if (filters.dateFrom && item.createdAt < filters.dateFrom) {
      return false;
    }
    if (filters.dateTo && item.createdAt > filters.dateTo) {
      return false;
    }

    const qTags = filters.questionTagMap?.get(item.id);
    if (filters.tagIds && filters.tagIds.length > 0) {
      if (!qTags) return false;
      const hasMatch = filters.tagIds.some((tid) => qTags.has(tid));
      if (!hasMatch) return false;
    }

    if (q) {
      const titleMatch = item.title.toLowerCase().includes(q);
      const descMatch = item.description.toLowerCase().includes(q);
      const conclusionMatch = item.conclusion.toLowerCase().includes(q);
      const deviceMatch = item.createdDeviceName.toLowerCase().includes(q);
      const catName = filters.categoryNameMap?.get(item.categoryId)?.toLowerCase() ?? '';
      const catMatch = catName.includes(q);

      let tagMatch = false;
      if (qTags && filters.tagNameMap) {
        for (const tid of qTags) {
          const tname = filters.tagNameMap.get(tid)?.toLowerCase() ?? '';
          if (tname.includes(q)) {
            tagMatch = true;
            break;
          }
        }
      }

      if (!titleMatch && !descMatch && !conclusionMatch && !catMatch && !tagMatch && !deviceMatch) {
        return false;
      }
    }

    return true;
  });

  const sortBy = filters.sortBy ?? 'newest';
  filtered.sort((a, b) => {
    // Always keep pinned items first within active views unless explicit chronological sort
    if (a.isPinned !== b.isPinned && (sortBy === 'newest' || sortBy === 'updated' || sortBy === 'priority')) {
      return a.isPinned ? -1 : 1;
    }
    switch (sortBy) {
      case 'oldest':
        return a.createdAt - b.createdAt;
      case 'updated':
        return b.updatedAt - a.updatedAt;
      case 'priority': {
        const diff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
        return diff !== 0 ? diff : b.updatedAt - a.updatedAt;
      }
      case 'researched':
        return (b.lastResearchedAt ?? 0) - (a.lastResearchedAt ?? 0);
      case 'newest':
      default:
        return b.createdAt - a.createdAt;
    }
  });

  return filtered;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

export function findPotentialDuplicates(
  candidateTitle: string,
  existingQuestions: Question[],
  excludeId?: string,
  threshold = 0.5,
): Array<{ question: Question; similarity: number }> {
  const normalizedCandidate = candidateTitle.trim().toLowerCase();
  if (!normalizedCandidate) return [];
  const candidateTokens = tokenize(normalizedCandidate);
  if (candidateTokens.size === 0) return [];

  const matches: Array<{ question: Question; similarity: number }> = [];
  for (const q of existingQuestions) {
    if (q.deletedAt !== null || q.id === excludeId) continue;
    const targetNorm = q.title.trim().toLowerCase();
    if (targetNorm === normalizedCandidate) {
      matches.push({ question: q, similarity: 1 });
      continue;
    }
    const targetTokens = tokenize(targetNorm);
    if (targetTokens.size === 0) continue;
    let intersection = 0;
    for (const token of candidateTokens) {
      if (targetTokens.has(token)) intersection++;
    }
    const union = candidateTokens.size + targetTokens.size - intersection;
    const jaccard = union > 0 ? intersection / union : 0;
    if (jaccard >= threshold) {
      matches.push({ question: q, similarity: jaccard });
    }
  }

  return matches.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
}
