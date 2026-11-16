import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Hash, FolderKanban } from 'lucide-react';
import { QuestBookSnapshot } from '../hooks/useQuestBookData';
import { QuestBookRepo } from '../db/repository';
import { useToast } from '../components/ToastProvider';

export const CategoriesPage: React.FC<{ data: QuestBookSnapshot }> = ({ data }) => {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of data.questions) {
      if (q.deletedAt === null && q.archivedAt === null) {
        map.set(q.categoryId, (map.get(q.categoryId) ?? 0) + 1);
      }
    }
    return map;
  }, [data.questions]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await QuestBookRepo.addCategory(name, description);
      setName('');
      setDescription('');
      showToast('Category created', name.trim(), 'success');
    } catch (err) {
      showToast('Error', err instanceof Error ? err.message : 'Failed to create category', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Categories</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          11 built-in knowledge domains plus your custom categories.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New custom category name..."
          required
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.categories.map((cat) => (
          <div
            key={cat.id}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <Link
                  to={`/questions?category=${cat.id}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  <FolderKanban className="w-4 h-4 text-slate-400" />
                  {cat.name}
                </Link>
                {!cat.isDefault && (
                  <button
                    type="button"
                    onClick={() => QuestBookRepo.deleteCategory(cat.id)}
                    aria-label={`Delete category ${cat.name}`}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {cat.description && (
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{cat.description}</p>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span className="tabular-nums">{counts.get(cat.id) ?? 0} questions</span>
              <span>{cat.isDefault ? 'Built-in' : 'Custom'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const TagsPage: React.FC<{ data: QuestBookSnapshot }> = ({ data }) => {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const qt of data.questionTags) {
      map.set(qt.tagId, (map.get(qt.tagId) ?? 0) + 1);
    }
    return map;
  }, [data.questionTags]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Tags</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Click any tag to inspect all associated questions.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {data.tags.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No tags created yet. Add tags when capturing or editing a question.</p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {data.tags.map((tag) => (
              <Link
                key={tag.id}
                to={`/questions?tag=${tag.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <span className="inline-flex items-center gap-2 font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
                  <Hash className="w-4 h-4 text-slate-400" />
                  {tag.name}
                </span>
                <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {counts.get(tag.id) ?? 0} questions
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
