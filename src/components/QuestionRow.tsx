import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Pin, Star, Trash2, RotateCcw, Archive } from 'lucide-react';
import { Question } from '../types/questbook';

interface QuestionRowProps {
  question: Question;
  categoryName: string;
  tagNames: string[];
  onToggleFavorite?: (q: Question) => void;
  onTogglePin?: (q: Question) => void;
  onDelete?: (q: Question) => void;
  onRestore?: (q: Question) => void;
  onArchive?: (q: Question) => void;
  isTrash?: boolean;
}

const STATUS_LABEL: Record<Question['status'], { text: string; tone: string }> = {
  new: { text: 'New', tone: 'text-indigo-600 dark:text-indigo-400' },
  unexplored: { text: 'Unexplored', tone: 'text-amber-700 dark:text-amber-400' },
  exploring: { text: 'Exploring', tone: 'text-sky-700 dark:text-sky-400' },
  completed: { text: 'Completed', tone: 'text-emerald-700 dark:text-emerald-400' },
};

const PRIORITY_LABEL: Record<Question['priority'], string> = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
};

export function formatShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const QuestionRow: React.FC<QuestionRowProps> = ({
  question,
  categoryName,
  tagNames,
  onToggleFavorite,
  onTogglePin,
  onDelete,
  onRestore,
  onArchive,
  isTrash = false,
}) => {
  const statusInfo = STATUS_LABEL[question.status];

  return (
    <article className="group flex flex-col gap-2 py-4 px-4 sm:px-5 border-b border-slate-200 dark:border-slate-800 last:border-b-0 hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link
            to={`/workspace/${question.id}`}
            className="inline-flex items-baseline gap-1.5 text-[15px] font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors leading-snug"
          >
            <span>{question.title}</span>
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity translate-y-0.5" />
          </Link>
          {question.description && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
              {question.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!isTrash && onTogglePin && (
            <button
              type="button"
              onClick={() => onTogglePin(question)}
              aria-label={question.isPinned ? `Unpin "${question.title}"` : `Pin "${question.title}"`}
              title={question.isPinned ? 'Unpin' : 'Pin'}
              className={`p-2 rounded-lg transition-colors ${
                question.isPinned
                  ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Pin className="w-4 h-4" />
            </button>
          )}
          {!isTrash && onToggleFavorite && (
            <button
              type="button"
              onClick={() => onToggleFavorite(question)}
              aria-label={question.isFavorite ? `Remove "${question.title}" from favorites` : `Favorite "${question.title}"`}
              title={question.isFavorite ? 'Remove favorite' : 'Favorite'}
              className={`p-2 rounded-lg transition-colors ${
                question.isFavorite
                  ? 'text-amber-500'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Star className={`w-4 h-4 ${question.isFavorite ? 'fill-current' : ''}`} />
            </button>
          )}
          {!isTrash && onArchive && (
            <button
              type="button"
              onClick={() => onArchive(question)}
              aria-label={`Archive "${question.title}"`}
              title="Archive"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Archive className="w-4 h-4" />
            </button>
          )}
          {isTrash && onRestore && (
            <button
              type="button"
              onClick={() => onRestore(question)}
              aria-label={`Restore "${question.title}"`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restore
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(question)}
              aria-label={isTrash ? `Permanently delete "${question.title}"` : `Delete "${question.title}"`}
              title={isTrash ? 'Delete forever' : 'Move to Trash'}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Zero-pill quiet metadata line with typographic separators */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span className={`font-medium ${statusInfo.tone}`}>{statusInfo.text}</span>
        <span aria-hidden="true">·</span>
        <span>{categoryName}</span>
        <span aria-hidden="true">·</span>
        <span className={question.priority === 'high' ? 'text-rose-600 dark:text-rose-400 font-medium' : ''}>
          {PRIORITY_LABEL[question.priority]}
        </span>
        {tagNames.length > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              {tagNames.map((t) => `#${t}`).join(' ')}
            </span>
          </>
        )}
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">{formatShortDate(question.createdAt)}</span>
        <span aria-hidden="true">·</span>
        <span>Created on {question.createdDeviceName}</span>
        {question.lastSyncedFromDeviceName && question.lastSyncedAt && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-indigo-600 dark:text-indigo-400">
              Received from {question.lastSyncedFromDeviceName} · {formatTime(question.lastSyncedAt)}
            </span>
          </>
        )}
      </div>
    </article>
  );
};
