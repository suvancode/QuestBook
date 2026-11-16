import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PlusCircle, Trash2 } from 'lucide-react';
import { QuestBookSnapshot } from '../hooks/useQuestBookData';
import { searchAndFilterQuestions, SortOrder } from '../core/search';
import { QuestionRow } from '../components/QuestionRow';
import { QuestBookRepo } from '../db/repository';
import { useToast } from '../components/ToastProvider';
import { Question, QuestionPriority, QuestionStatus } from '../types/questbook';

interface QuestionsListPageProps {
  data: QuestBookSnapshot;
  mode: 'inbox' | 'all' | 'favorites' | 'trash';
}

const PAGE_SIZE = 25;

export const QuestionsListPage: React.FC<QuestionsListPageProps> = ({ data, mode }) => {
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const initialCategory = searchParams.get('category') ?? 'all';
  const initialTag = searchParams.get('tag') ?? '';
  const initialStatus = (searchParams.get('status') as QuestionStatus | null) ?? 'all';

  const [statusFilter, setStatusFilter] = useState<QuestionStatus | 'all'>(initialStatus);
  const [priorityFilter, setPriorityFilter] = useState<QuestionPriority | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory);
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState<SortOrder>('newest');
  const [page, setPage] = useState(1);

  const categoryNameMap = useMemo(
    () => new Map(data.categories.map((c) => [c.id, c.name])),
    [data.categories],
  );
  const tagNameMap = useMemo(() => new Map(data.tags.map((t) => [t.id, t.name])), [data.tags]);
  const questionTagMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const qt of data.questionTags) {
      if (!map.has(qt.questionId)) map.set(qt.questionId, new Set());
      map.get(qt.questionId)!.add(qt.tagId);
    }
    return map;
  }, [data.questionTags]);

  const filtered = useMemo(() => {
    let base = searchAndFilterQuestions(data.questions, {
      categoryId: categoryFilter,
      tagIds: initialTag ? [initialTag] : undefined,
      questionTagMap,
      tagNameMap,
      categoryNameMap,
      status: mode === 'inbox' ? 'all' : statusFilter,
      priority: priorityFilter,
      favoritesOnly: mode === 'favorites',
      includeArchived: showArchived,
      includeDeleted: mode === 'trash',
      sortBy,
    });

    if (mode === 'inbox') {
      base = base.filter((q) => q.status === 'new' || q.status === 'unexplored');
    }
    return base;
  }, [
    data.questions,
    categoryFilter,
    initialTag,
    questionTagMap,
    tagNameMap,
    categoryNameMap,
    mode,
    statusFilter,
    priorityFilter,
    showArchived,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const heading =
    mode === 'inbox'
      ? 'Inbox — New & Unexplored'
      : mode === 'favorites'
        ? 'Favorites & Pinned'
        : mode === 'trash'
          ? 'Trash (Recoverable Tombstones)'
          : 'All Questions';

  const handleToggleFavorite = async (q: Question) => {
    await QuestBookRepo.updateQuestion(q.id, { isFavorite: !q.isFavorite }, 'edited');
  };
  const handleTogglePin = async (q: Question) => {
    await QuestBookRepo.updateQuestion(q.id, { isPinned: !q.isPinned }, 'edited');
  };
  const handleArchive = async (q: Question) => {
    await QuestBookRepo.updateQuestion(
      q.id,
      { archivedAt: q.archivedAt ? null : Date.now() },
      'archived',
      q.archivedAt ? 'Unarchived' : 'Archived',
    );
    showToast(q.archivedAt ? 'Unarchived question' : 'Archived question', q.title, 'info');
  };
  const handleDelete = async (q: Question) => {
    if (mode === 'trash') {
      await QuestBookRepo.permanentlyPurgeQuestion(q.id);
      showToast('Permanently deleted', q.title, 'info');
    } else {
      await QuestBookRepo.softDeleteQuestion(q.id);
      showToast('Moved to Trash', 'Recoverable from Trash at any time.', 'info');
    }
  };
  const handleRestore = async (q: Question) => {
    await QuestBookRepo.restoreQuestion(q.id);
    showToast('Question restored', q.title, 'success');
  };
  const handleEmptyTrash = async () => {
    for (const q of filtered) {
      await QuestBookRepo.permanentlyPurgeQuestion(q.id);
    }
    showToast('Trash emptied', `Purged ${filtered.length} question(s) permanently.`, 'info');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{heading}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
            {filtered.length} question{filtered.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mode !== 'inbox' && mode !== 'trash' && (
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as QuestionStatus | 'all');
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="unexplored">Unexplored</option>
              <option value="exploring">Exploring</option>
              <option value="completed">Completed</option>
            </select>
          )}

          {mode !== 'trash' && (
            <>
              <select
                aria-label="Filter by priority"
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value as QuestionPriority | 'all');
                  setPage(1);
                }}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200"
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <select
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200"
              >
                <option value="all">All Categories</option>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="Sort questions"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOrder)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="updated">Recently updated</option>
                <option value="priority">Highest priority</option>
                <option value="researched">Recently researched</option>
              </select>
            </>
          )}

          {mode === 'all' && (
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 px-2">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600"
              />
              Include archived
            </label>
          )}

          {mode === 'trash' && filtered.length > 0 && (
            <button
              type="button"
              onClick={handleEmptyTrash}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 dark:border-rose-800 px-3 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Purge All Permanently
            </button>
          )}
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {visibleItems.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {mode === 'trash'
                ? 'Trash is empty.'
                : mode === 'favorites'
                  ? 'No favorited or pinned questions yet.'
                  : 'No questions match the current filters.'}
            </p>
            {mode !== 'trash' && (
              <Link
                to="/capture"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Capture a Question
              </Link>
            )}
          </div>
        ) : (
          <div>
            {visibleItems.map((q) => {
              const tagIds = questionTagMap.get(q.id);
              const tNames = tagIds ? Array.from(tagIds).map((id) => tagNameMap.get(id) ?? '').filter(Boolean) : [];
              return (
                <QuestionRow
                  key={q.id}
                  question={q}
                  categoryName={categoryNameMap.get(q.categoryId) ?? 'General'}
                  tagNames={tNames}
                  isTrash={mode === 'trash'}
                  onToggleFavorite={handleToggleFavorite}
                  onTogglePin={handleTogglePin}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                  onRestore={handleRestore}
                />
              );
            })}
          </div>
        )}
      </section>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="tabular-nums">
            Page {safePage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
