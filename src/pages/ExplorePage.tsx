import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shuffle, Bell, Clock, Check, Sparkles } from 'lucide-react';
import { QuestBookSnapshot } from '../hooks/useQuestBookData';
import { QuestBookRepo } from '../db/repository';
import { useToast } from '../components/ToastProvider';
import { formatShortDate } from '../components/QuestionRow';

interface ExplorePageProps {
  data: QuestBookSnapshot;
}

export const ExplorePage: React.FC<ExplorePageProps> = ({ data }) => {
  const { showToast } = useToast();
  const active = useMemo(
    () => data.questions.filter((q) => q.deletedAt === null && q.archivedAt === null),
    [data.questions],
  );
  const categoryMap = useMemo(() => new Map(data.categories.map((c) => [c.id, c.name])), [data.categories]);

  const [randomIndex, setRandomIndex] = useState(0);
  const [remQuestionId, setRemQuestionId] = useState(() => active[0]?.id ?? '');
  const [remDate, setRemDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [remNote, setRemNote] = useState('');

  // Deterministic Daily Question based on YYYY-MM-DD
  const dailyQuestion = useMemo(() => {
    const pool = active.filter((q) => q.status !== 'completed');
    const source = pool.length > 0 ? pool : active;
    if (source.length === 0) return null;
    const dayKey = new Date().toISOString().slice(0, 10);
    let hash = 0;
    for (let i = 0; i < dayKey.length; i++) hash = (hash * 31 + dayKey.charCodeAt(i)) >>> 0;
    return source[hash % source.length];
  }, [active]);

  const randomQuestion = active.length > 0 ? active[randomIndex % active.length] : null;

  const forgottenQuestions = useMemo(() => {
    const cutoff = Date.now() - 5 * 24 * 60 * 60 * 1000;
    return active
      .filter((q) => q.status !== 'completed' && q.updatedAt < cutoff)
      .sort((a, b) => a.updatedAt - b.updatedAt);
  }, [active]);

  const activeReminders = useMemo(
    () => data.reminders.filter((r) => !r.dismissed).sort((a, b) => a.dueAt - b.dueAt),
    [data.reminders],
  );

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = remQuestionId || active[0]?.id;
    if (!targetId) return;
    const dueTs = new Date(`${remDate}T09:00:00`).getTime();
    await QuestBookRepo.upsertReminder(targetId, dueTs, remNote || 'Revisit this curiosity question');
    setRemNote('');
    showToast('Reminder scheduled', `Set for ${remDate}`, 'success');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Explore &amp; Rediscovery</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Gentle surfacing of unanswered questions and forgotten curiosity — without noisy notifications.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-2">
            <Sparkles className="w-4 h-4" />
            Daily Question Suggestion
          </div>
          {dailyQuestion ? (
            <>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                {dailyQuestion.title}
              </h2>
              {dailyQuestion.description && (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 line-clamp-3">
                  {dailyQuestion.description}
                </p>
              )}
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {categoryMap.get(dailyQuestion.categoryId) ?? 'General'} · {formatShortDate(dailyQuestion.createdAt)}
              </p>
              <Link
                to={`/workspace/${dailyQuestion.id}`}
                className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
              >
                Open in Research Workspace
              </Link>
            </>
          ) : (
            <p className="text-sm text-slate-500">Add questions to receive a daily suggestion.</p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Random Question Roulette</span>
            <button
              type="button"
              onClick={() => setRandomIndex(Math.floor(Math.random() * Math.max(1, active.length)))}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              <Shuffle className="w-3.5 h-3.5" />
              Draw Another
            </button>
          </div>
          {randomQuestion ? (
            <>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                {randomQuestion.title}
              </h2>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Status: {randomQuestion.status} · Created on {randomQuestion.createdDeviceName}
              </p>
              <Link
                to={`/workspace/${randomQuestion.id}`}
                className="mt-4 inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Explore This Question
              </Link>
            </>
          ) : (
            <p className="text-sm text-slate-500">No questions in vault yet.</p>
          )}
        </section>
      </div>

      {/* Forgotten & Unanswered */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Forgotten &amp; Dormant Questions ({forgottenQuestions.length})
          </h2>
        </div>
        {forgottenQuestions.length === 0 ? (
          <p className="p-5 text-xs text-slate-500 dark:text-slate-400">
            All open questions have recent activity within the past 5 days.
          </p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {forgottenQuestions.map((q) => (
              <Link
                key={q.id}
                to={`/workspace/${q.id}`}
                className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{q.title}</span>
                <span className="text-xs text-slate-500 tabular-nums shrink-0">
                  Captured {formatShortDate(q.createdAt)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Optional Gentle Reminders */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          Optional Study Reminders
        </h2>

        <form onSubmit={handleCreateReminder} className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-5">
          <select
            aria-label="Select question for reminder"
            value={remQuestionId || active[0]?.id || ''}
            onChange={(e) => setRemQuestionId(e.target.value)}
            className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
          >
            {active.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title.slice(0, 70)}
              </option>
            ))}
          </select>
          <input
            type="date"
            aria-label="Reminder date"
            value={remDate}
            onChange={(e) => setRemDate(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={active.length === 0}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Schedule Reminder
          </button>
        </form>

        {activeReminders.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">No pending reminders.</p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
            {activeReminders.map((r) => {
              const q = active.find((item) => item.id === r.questionId);
              const overdue = r.dueAt < Date.now();
              return (
                <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                  <div className="min-w-0">
                    <Link
                      to={`/workspace/${r.questionId}`}
                      className="font-medium text-slate-900 dark:text-slate-100 hover:underline block truncate"
                    >
                      {q?.title ?? 'Question'}
                    </Link>
                    <span className={overdue ? 'text-rose-600 dark:text-rose-400 font-medium' : 'text-slate-500'}>
                      {overdue ? 'Overdue · ' : 'Due · '}
                      {formatShortDate(r.dueAt)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => QuestBookRepo.dismissReminder(r.id)}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
                  >
                    <Check className="w-3 h-3" />
                    Dismiss
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
