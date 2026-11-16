import React, { useEffect, useMemo, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { QuestBookSnapshot } from '../hooks/useQuestBookData';
import { searchAndFilterQuestions, SortOrder } from '../core/search';
import { QuestionRow } from '../components/QuestionRow';
import { QuestBookRepo } from '../db/repository';
import { QuestionPriority, QuestionStatus, SourceType } from '../types/questbook';

export const SearchPage: React.FC<{ data: QuestBookSnapshot }> = ({ data }) => {
  const [rawQuery, setRawQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [status, setStatus] = useState<QuestionStatus | 'all'>('all');
  const [priority, setPriority] = useState<QuestionPriority | 'all'>('all');
  const [sourceType, setSourceType] = useState<SourceType | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [sortBy, setSortBy] = useState<SortOrder>('newest');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(rawQuery), 160);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const categoryNameMap = useMemo(() => new Map(data.categories.map((c) => [c.id, c.name])), [data.categories]);
  const tagNameMap = useMemo(() => new Map(data.tags.map((t) => [t.id, t.name])), [data.tags]);
  const questionTagMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const qt of data.questionTags) {
      if (!map.has(qt.questionId)) map.set(qt.questionId, new Set());
      map.get(qt.questionId)!.add(qt.tagId);
    }
    return map;
  }, [data.questionTags]);

  const results = useMemo(() => {
    return searchAndFilterQuestions(data.questions, {
      query: debouncedQuery,
      categoryId,
      status,
      priority,
      sourceType,
      dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null,
      questionTagMap,
      tagNameMap,
      categoryNameMap,
      sortBy,
    });
  }, [
    data.questions,
    debouncedQuery,
    categoryId,
    status,
    priority,
    sourceType,
    dateFrom,
    questionTagMap,
    tagNameMap,
    categoryNameMap,
    sortBy,
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Local Search</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Searches titles, descriptions, conclusions, tags, categories, and device origin offline in IndexedDB.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <label htmlFor="local-search-input" className="sr-only">
            Search questions
          </label>
          <input
            id="local-search-input"
            type="search"
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            autoFocus
            placeholder="Search by title, keyword, #tag, category, or device name..."
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <select
            aria-label="Category filter"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="all">All Categories</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Status filter"
            value={status}
            onChange={(e) => setStatus(e.target.value as QuestionStatus | 'all')}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="unexplored">Unexplored</option>
            <option value="exploring">Exploring</option>
            <option value="completed">Completed</option>
          </select>

          <select
            aria-label="Priority filter"
            value={priority}
            onChange={(e) => setPriority(e.target.value as QuestionPriority | 'all')}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            aria-label="Source filter"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as SourceType | 'all')}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="all">All Sources</option>
            <option value="text">Text</option>
            <option value="voice">Voice</option>
            <option value="image">Image</option>
            <option value="share">Shared</option>
            <option value="seed">Starter</option>
          </select>

          <input
            type="date"
            aria-label="Created after date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100"
          />

          <select
            aria-label="Sort results"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOrder)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="updated">Recently updated</option>
            <option value="priority">Highest priority</option>
            <option value="researched">Recently researched</option>
          </select>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <span className="tabular-nums font-medium">{results.length} result(s)</span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-slate-400" />
            Semantic AI Search: {data.preferences.aiFeaturesEnabled ? 'Configured' : 'Disabled (Local Keyword Mode)'}
          </span>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {results.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No matching questions found locally.</p>
        ) : (
          results.slice(0, 100).map((q) => {
            const tagIds = questionTagMap.get(q.id);
            const tNames = tagIds ? Array.from(tagIds).map((id) => tagNameMap.get(id) ?? '').filter(Boolean) : [];
            return (
              <QuestionRow
                key={q.id}
                question={q}
                categoryName={categoryNameMap.get(q.categoryId) ?? 'General'}
                tagNames={tNames}
                onToggleFavorite={(item) => QuestBookRepo.updateQuestion(item.id, { isFavorite: !item.isFavorite })}
                onTogglePin={(item) => QuestBookRepo.updateQuestion(item.id, { isPinned: !item.isPinned })}
                onDelete={(item) => QuestBookRepo.softDeleteQuestion(item.id)}
              />
            );
          })
        )}
      </section>
    </div>
  );
};
