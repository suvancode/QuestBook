import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Shuffle, PlusCircle, Clock, Sparkles } from 'lucide-react';
import { QuestBookSnapshot } from '../hooks/useQuestBookData';
import { QuestBookRepo } from '../db/repository';
import { useToast } from '../components/ToastProvider';
import { formatShortDate } from '../components/QuestionRow';
import { Question } from '../types/questbook';

interface DashboardPageProps {
  data: QuestBookSnapshot;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ data }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [quickTitle, setQuickTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const activeQuestions = useMemo(
    () => data.questions.filter((q) => q.deletedAt === null && q.archivedAt === null),
    [data.questions],
  );

  const categoryMap = useMemo(() => new Map(data.categories.map((c) => [c.id, c.name])), [data.categories]);

  const stats = useMemo(() => {
    const unexplored = activeQuestions.filter((q) => q.status === 'new' || q.status === 'unexplored').length;
    const exploring = activeQuestions.filter((q) => q.status === 'exploring').length;
    const completed = activeQuestions.filter((q) => q.status === 'completed').length;
    return {
      total: activeQuestions.length,
      unexplored,
      exploring,
      completed,
    };
  }, [activeQuestions]);

  const continueResearching = useMemo(
    () =>
      activeQuestions
        .filter((q) => q.status === 'exploring')
        .sort((a, b) => (b.lastResearchedAt ?? b.updatedAt) - (a.lastResearchedAt ?? a.updatedAt))
        .slice(0, 4),
    [activeQuestions],
  );

  const recentlyCaptured = useMemo(
    () => [...activeQuestions].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5),
    [activeQuestions],
  );

  const highPriority = useMemo(
    () =>
      activeQuestions
        .filter((q) => q.priority === 'high' && q.status !== 'completed')
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 4),
    [activeQuestions],
  );

  const oldUnanswered = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return activeQuestions
      .filter((q) => (q.status === 'new' || q.status === 'unexplored') && q.createdAt < cutoff)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, 4);
  }, [activeQuestions]);

  const receivedFromPeers = useMemo(
    () =>
      activeQuestions
        .filter((q) => q.lastSyncedFromDeviceId !== null)
        .sort((a, b) => (b.lastSyncedAt ?? 0) - (a.lastSyncedAt ?? 0))
        .slice(0, 4),
    [activeQuestions],
  );

  const [randomPick, setRandomPick] = useState<Question | null>(null);
  const discoveryQuestion = useMemo(() => {
    if (randomPick) return randomPick;
    const pool = activeQuestions.filter((q) => q.status !== 'completed');
    return pool[0] ?? activeQuestions[0] ?? null;
  }, [activeQuestions, randomPick]);

  const handleInstantCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    setSaving(true);
    try {
      const created = await QuestBookRepo.createQuestion({ title: quickTitle });
      setQuickTitle('');
      showToast('Question captured locally', `Saved to IndexedDB on ${created.createdDeviceName}`, 'success');
    } catch (err) {
      showToast('Could not save question', err instanceof Error ? err.message : 'Unknown error', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleShuffleRandom = () => {
    const pool = activeQuestions.filter((q) => q.status !== 'completed');
    const source = pool.length > 0 ? pool : activeQuestions;
    if (source.length === 0) return;
    const next = source[Math.floor(Math.random() * source.length)];
    setRandomPick(next);
  };

  return (
    <div className="space-y-6">
      {/* Top 5-Second Instant Capture Strip */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Capture Curiosity. Discover Knowledge.
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Offline-first vault on {data.localSecret?.deviceName ?? 'this device'}
            </p>
          </div>
          <Link
            to="/capture"
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap shrink-0"
          >
            Voice, image &amp; full capture options →
          </Link>
        </div>

        <form onSubmit={handleInstantCapture} className="mt-4 flex flex-col sm:flex-row gap-2.5">
          <label htmlFor="dashboard-quick-capture" className="sr-only">
            Capture a new question
          </label>
          <input
            id="dashboard-quick-capture"
            type="text"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="What are you curious about right now? (Press Enter to save locally)"
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={saving || !quickTitle.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            Save Question
          </button>
        </form>
      </section>

      {/* 4-Column KPI Strip */}
      <section aria-label="Question summary counts" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/questions"
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-indigo-400 transition-colors"
        >
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Questions</div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {stats.total}
          </div>
        </Link>
        <Link
          to="/inbox"
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-indigo-400 transition-colors"
        >
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Unexplored</div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
            {stats.unexplored}
          </div>
        </Link>
        <Link
          to="/questions?status=exploring"
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-indigo-400 transition-colors"
        >
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Exploring</div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-sky-600 dark:text-sky-400">
            {stats.exploring}
          </div>
        </Link>
        <Link
          to="/questions?status=completed"
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-indigo-400 transition-colors"
        >
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Completed</div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {stats.completed}
          </div>
        </Link>
      </section>

      {/* Main Two-Column Discovery & Active Research Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Continue Researching & Recently Captured */}
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Continue Researching</h2>
              <Link to="/workspace" className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                Open workspace
              </Link>
            </div>
            {continueResearching.length === 0 ? (
              <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
                No questions currently in active exploration. Open any question to start a research session.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {continueResearching.map((q) => (
                  <Link
                    key={q.id}
                    to={`/workspace/${q.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{q.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {categoryMap.get(q.categoryId) ?? 'General'} · {q.keyFindings.length} finding(s) · Created on {q.createdDeviceName}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Recently Captured</h2>
              <Link to="/questions" className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                View all
              </Link>
            </div>
            {recentlyCaptured.length === 0 ? (
              <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
                Your question vault is empty. Capture your first question above.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {recentlyCaptured.map((q) => (
                  <Link
                    key={q.id}
                    to={`/workspace/${q.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{q.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {categoryMap.get(q.categoryId) ?? 'General'} · {q.status} · {formatShortDate(q.createdAt)} · Created on {q.createdDeviceName}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Rediscovery, High Priority, Old Unanswered, Peer Sync */}
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Rediscover Question
              </h2>
              <button
                type="button"
                onClick={handleShuffleRandom}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <Shuffle className="w-3.5 h-3.5" />
                Random
              </button>
            </div>
            {discoveryQuestion ? (
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-snug">
                  {discoveryQuestion.title}
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {categoryMap.get(discoveryQuestion.categoryId) ?? 'General'} · {formatShortDate(discoveryQuestion.createdAt)}
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/workspace/${discoveryQuestion.id}`)}
                  className="mt-4 w-full rounded-lg border border-slate-200 dark:border-slate-700 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Investigate Now
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">Capture questions to enable rediscovery.</p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">High Priority</h2>
            {highPriority.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">No open high-priority questions.</p>
            ) : (
              <ul className="space-y-2.5">
                {highPriority.map((q) => (
                  <li key={q.id}>
                    <Link
                      to={`/workspace/${q.id}`}
                      className="block text-xs font-medium text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 truncate"
                    >
                      {q.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Old Unanswered (&gt;7 days)
            </h2>
            {oldUnanswered.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">No unanswered questions older than 7 days.</p>
            ) : (
              <ul className="space-y-2.5">
                {oldUnanswered.map((q) => (
                  <li key={q.id}>
                    <Link
                      to={`/workspace/${q.id}`}
                      className="block text-xs font-medium text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 truncate"
                    >
                      {q.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Received From Other Devices
            </h2>
            {receivedFromPeers.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pair another device in Device Manager to synchronize questions without a cloud server.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {receivedFromPeers.map((q) => (
                  <li key={q.id}>
                    <Link
                      to={`/workspace/${q.id}`}
                      className="block text-xs font-medium text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 truncate"
                    >
                      {q.title}
                    </Link>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Origin: {q.createdDeviceName} · Via {q.lastSyncedFromDeviceName}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
