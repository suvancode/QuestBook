import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  RotateCcw,
  Pin,
  Star,
  Plus,
  ExternalLink,
  ImagePlus,
  Link2,
  History,
  Trash2,
  Edit3,
  Save,
} from 'lucide-react';
import { QuestBookSnapshot } from '../hooks/useQuestBookData';
import { QuestBookRepo } from '../db/repository';
import { ExternalResearchLauncher } from '../components/ExternalResearchLauncher';
import { useToast } from '../components/ToastProvider';
import { QuestionPriority, QuestionStatus, RelatedQuestion, ResearchResource } from '../types/questbook';
import { formatShortDate } from '../components/QuestionRow';

export const ResearchWorkspacePage: React.FC<{ data: QuestBookSnapshot }> = ({ data }) => {
  const { questionId } = useParams<{ questionId?: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const activeQuestions = useMemo(
    () => data.questions.filter((q) => q.deletedAt === null),
    [data.questions],
  );

  const selectedQuestion = useMemo(() => {
    if (questionId) return activeQuestions.find((q) => q.id === questionId) ?? null;
    return activeQuestions.find((q) => q.status === 'exploring') ?? activeQuestions[0] ?? null;
  }, [activeQuestions, questionId]);

  const [editingHeader, setEditingHeader] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTags, setEditTags] = useState('');

  // Session & note inputs
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [noteProvider, setNoteProvider] = useState('Perplexity');
  const [noteContent, setNoteContent] = useState('');
  const [noteIsKey, setNoteIsKey] = useState(false);
  const [compareProviderFilter, setCompareProviderFilter] = useState('all');

  // Resource inputs
  const [resTitle, setResTitle] = useState('');
  const [resUrl, setResUrl] = useState('');
  const [resType, setResType] = useState<ResearchResource['resourceType']>('article');

  // Related question input
  const [relatedTargetId, setRelatedTargetId] = useState('');
  const [relatedKind, setRelatedKind] = useState<RelatedQuestion['relationship']>('follow_up');

  // Conclusion & finding input
  const [conclusionDraft, setConclusionDraft] = useState<string | null>(null);
  const [newFinding, setNewFinding] = useState('');

  const questionTagIds = useMemo(() => {
    if (!selectedQuestion) return [];
    return data.questionTags
      .filter((qt) => qt.questionId === selectedQuestion.id)
      .map((qt) => qt.tagId);
  }, [data.questionTags, selectedQuestion]);

  const tagNameMap = useMemo(() => new Map(data.tags.map((t) => [t.id, t.name])), [data.tags]);
  const questionTagNames = useMemo(
    () => questionTagIds.map((id) => tagNameMap.get(id) ?? '').filter(Boolean),
    [questionTagIds, tagNameMap],
  );

  const sessions = useMemo(
    () =>
      selectedQuestion
        ? data.researchSessions
            .filter((s) => s.questionId === selectedQuestion.id)
            .sort((a, b) => b.startedAt - a.startedAt)
        : [],
    [data.researchSessions, selectedQuestion],
  );

  const currentSessionId = activeSessionId ?? sessions[0]?.id ?? null;

  const notes = useMemo(
    () =>
      selectedQuestion
        ? data.researchNotes
            .filter((n) => n.questionId === selectedQuestion.id)
            .sort((a, b) => b.createdAt - a.createdAt)
        : [],
    [data.researchNotes, selectedQuestion],
  );

  const noteProviders = useMemo(
    () => Array.from(new Set(notes.map((n) => n.providerName))),
    [notes],
  );

  const filteredNotes = useMemo(
    () => (compareProviderFilter === 'all' ? notes : notes.filter((n) => n.providerName === compareProviderFilter)),
    [notes, compareProviderFilter],
  );

  const resources = useMemo(
    () =>
      selectedQuestion
        ? data.researchResources
            .filter((r) => r.questionId === selectedQuestion.id)
            .sort((a, b) => b.createdAt - a.createdAt)
        : [],
    [data.researchResources, selectedQuestion],
  );

  const attachments = useMemo(
    () =>
      selectedQuestion
        ? data.attachments.filter((a) => a.questionId === selectedQuestion.id)
        : [],
    [data.attachments, selectedQuestion],
  );

  const activities = useMemo(
    () =>
      selectedQuestion
        ? data.researchActivities.filter((a) => a.questionId === selectedQuestion.id)
        : [],
    [data.researchActivities, selectedQuestion],
  );

  const relatedLinks = useMemo(
    () =>
      selectedQuestion
        ? data.relatedQuestions.filter((rq) => rq.questionId === selectedQuestion.id)
        : [],
    [data.relatedQuestions, selectedQuestion],
  );

  const historyEvents = useMemo(
    () =>
      selectedQuestion
        ? data.questionDeviceHistory
            .filter((h) => h.questionId === selectedQuestion.id)
            .sort((a, b) => b.timestamp - a.timestamp)
        : [],
    [data.questionDeviceHistory, selectedQuestion],
  );

  if (!selectedQuestion) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Research Workspace</h1>
        <p className="mt-2 text-sm text-slate-500">No active questions found. Capture a question to begin researching.</p>
        <Link
          to="/capture"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          Capture First Question
        </Link>
      </div>
    );
  }

  const startEdit = () => {
    setEditTitle(selectedQuestion.title);
    setEditDesc(selectedQuestion.description);
    setEditTags(questionTagNames.join(', '));
    setEditingHeader(true);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    await QuestBookRepo.updateQuestion(selectedQuestion.id, {
      title: editTitle.trim(),
      description: editDesc.trim(),
    });
    await QuestBookRepo.setQuestionTags(
      selectedQuestion.id,
      editTags.split(',').map((t) => t.trim()).filter(Boolean),
    );
    setEditingHeader(false);
    showToast('Question updated', 'Changes saved locally and journaled for sync.', 'success');
  };

  const handleToggleComplete = async () => {
    if (selectedQuestion.status === 'completed') {
      await QuestBookRepo.updateQuestion(selectedQuestion.id, { status: 'exploring' }, 'reopened', 'Reopened for further exploration');
      showToast('Question reopened', 'Status set back to Exploring.', 'info');
    } else {
      await QuestBookRepo.updateQuestion(
        selectedQuestion.id,
        { status: 'completed', conclusion: conclusionDraft ?? selectedQuestion.conclusion },
        'completed',
        'Marked research as completed',
      );
      showToast('Question completed', 'Findings preserved in your knowledge vault.', 'success');
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const s = await QuestBookRepo.createResearchSession(
      selectedQuestion.id,
      newSessionTitle || `Session ${sessions.length + 1}`,
    );
    setActiveSessionId(s.id);
    setNewSessionTitle('');
    showToast('Research session started', s.title, 'success');
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await QuestBookRepo.addResearchNote({
        questionId: selectedQuestion.id,
        sessionId: currentSessionId,
        providerName: noteProvider,
        content: noteContent,
        isKeyFinding: noteIsKey,
      });
      if (noteIsKey && noteContent.trim()) {
        await QuestBookRepo.updateQuestion(selectedQuestion.id, {
          keyFindings: [...selectedQuestion.keyFindings, noteContent.trim()],
        });
      }
      setNoteContent('');
      setNoteIsKey(false);
      showToast('Research note saved', `Attributed to ${noteProvider}`, 'success');
    } catch (err) {
      showToast('Could not save note', err instanceof Error ? err.message : 'Error', 'error');
    }
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await QuestBookRepo.addResearchResource({
        questionId: selectedQuestion.id,
        sessionId: currentSessionId,
        title: resTitle,
        url: resUrl,
        resourceType: resType,
      });
      setResTitle('');
      setResUrl('');
      showToast('Reference saved', 'URL validated and stored locally.', 'success');
    } catch (err) {
      showToast('Invalid URL', err instanceof Error ? err.message : 'Error', 'error');
    }
  };

  const handleAddAttachment = async (files: FileList | null) => {
    if (!files?.[0]) return;
    const file = files[0];
    const dataUrl = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsDataURL(file);
    });
    await QuestBookRepo.addAttachment(selectedQuestion.id, {
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      dataUrl,
    });
    showToast('Attachment added', file.name, 'success');
  };

  const handleLinkRelated = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = relatedTargetId || activeQuestions.find((q) => q.id !== selectedQuestion.id)?.id;
    if (!target) return;
    try {
      await QuestBookRepo.linkRelatedQuestion(selectedQuestion.id, target, relatedKind);
      showToast('Related question linked', 'Relationship recorded locally.', 'success');
    } catch (err) {
      showToast('Cannot link question', err instanceof Error ? err.message : 'Error', 'error');
    }
  };

  const handleAddKeyFinding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFinding.trim()) return;
    await QuestBookRepo.updateQuestion(selectedQuestion.id, {
      keyFindings: [...selectedQuestion.keyFindings, newFinding.trim()],
    });
    setNewFinding('');
    showToast('Key finding recorded', undefined, 'success');
  };

  const handleSaveConclusion = async () => {
    await QuestBookRepo.updateQuestion(selectedQuestion.id, {
      conclusion: conclusionDraft ?? selectedQuestion.conclusion,
    });
    setConclusionDraft(null);
    showToast('Conclusion saved', undefined, 'success');
  };

  const otherQuestions = activeQuestions.filter((q) => q.id !== selectedQuestion.id);

  return (
    <div className="space-y-6">
      {/* Question Switcher & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 max-w-full">
          <label htmlFor="workspace-question-picker" className="text-xs font-medium text-slate-500 shrink-0">
            Active Question:
          </label>
          <select
            id="workspace-question-picker"
            value={selectedQuestion.id}
            onChange={(e) => {
              setActiveSessionId(null);
              setConclusionDraft(null);
              navigate(`/workspace/${e.target.value}`);
            }}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 max-w-[380px] truncate"
          >
            {activeQuestions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title.slice(0, 75)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => QuestBookRepo.updateQuestion(selectedQuestion.id, { isPinned: !selectedQuestion.isPinned })}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
              selectedQuestion.isPinned
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Pin className="w-3.5 h-3.5" />
            {selectedQuestion.isPinned ? 'Pinned' : 'Pin'}
          </button>
          <button
            type="button"
            onClick={() => QuestBookRepo.updateQuestion(selectedQuestion.id, { isFavorite: !selectedQuestion.isFavorite })}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
              selectedQuestion.isFavorite
                ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            {selectedQuestion.isFavorite ? 'Favorited' : 'Favorite'}
          </button>
          <button
            type="button"
            onClick={handleToggleComplete}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium text-white ${
              selectedQuestion.status === 'completed'
                ? 'bg-slate-700 hover:bg-slate-800'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {selectedQuestion.status === 'completed' ? (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                Reopen Question
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mark Completed
              </>
            )}
          </button>
        </div>
      </div>

      {/* 1. Original Question Header Card */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        {editingHeader ? (
          <form onSubmit={saveEdit} className="space-y-3">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-base font-semibold"
            />
            <textarea
              rows={3}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Description..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              placeholder="Comma-separated tags..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingHeader(false)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white"
              >
                <Save className="w-3.5 h-3.5" />
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-snug">
                  {selectedQuestion.title}
                </h1>
                {selectedQuestion.description && (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {selectedQuestion.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={startEdit}
                  aria-label="Edit question details"
                  className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await QuestBookRepo.softDeleteQuestion(selectedQuestion.id);
                    showToast('Moved to Trash', undefined, 'info');
                    navigate('/questions');
                  }}
                  aria-label="Move question to trash"
                  className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Metadata Controls */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-4 text-xs">
              <label className="flex items-center gap-1.5 text-slate-500">
                <span>Status:</span>
                <select
                  value={selectedQuestion.status}
                  onChange={(e) =>
                    QuestBookRepo.updateQuestion(selectedQuestion.id, {
                      status: e.target.value as QuestionStatus,
                    })
                  }
                  className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-slate-800 dark:text-slate-200"
                >
                  <option value="new">New</option>
                  <option value="unexplored">Unexplored</option>
                  <option value="exploring">Exploring</option>
                  <option value="completed">Completed</option>
                </select>
              </label>

              <label className="flex items-center gap-1.5 text-slate-500">
                <span>Priority:</span>
                <select
                  value={selectedQuestion.priority}
                  onChange={(e) =>
                    QuestBookRepo.updateQuestion(selectedQuestion.id, {
                      priority: e.target.value as QuestionPriority,
                    })
                  }
                  className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-slate-800 dark:text-slate-200"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>

              <label className="flex items-center gap-1.5 text-slate-500">
                <span>Category:</span>
                <select
                  value={selectedQuestion.categoryId}
                  onChange={(e) =>
                    QuestBookRepo.updateQuestion(selectedQuestion.id, { categoryId: e.target.value })
                  }
                  className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-slate-800 dark:text-slate-200"
                >
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <span className="text-slate-500 dark:text-slate-400">
                Created on <strong>{selectedQuestion.createdDeviceName}</strong> · {formatShortDate(selectedQuestion.createdAt)}
              </span>

              {selectedQuestion.lastSyncedFromDeviceName && (
                <span className="text-indigo-600 dark:text-indigo-400">
                  Synced from {selectedQuestion.lastSyncedFromDeviceName}
                </span>
              )}

              {questionTagNames.length > 0 && (
                <span className="font-mono text-slate-500">
                  {questionTagNames.map((t) => `#${t}`).join(' ')}
                </span>
              )}
            </div>
          </>
        )}
      </section>

      {/* 2. External Research Launcher */}
      <ExternalResearchLauncher
        questionId={selectedQuestion.id}
        questionTitle={selectedQuestion.title}
        activeSessionId={currentSessionId}
        providers={data.searchProviders}
        activities={activities}
      />

      {/* 3. Research Sessions & Notes + Provider Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Sessions, Notes & Conclusion */}
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Research Sessions ({sessions.length})
              </h2>
              <form onSubmit={handleCreateSession} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  placeholder="New session title..."
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-3 py-1.5 text-xs font-medium whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Start Session
                </button>
              </form>
            </div>

            {sessions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSessionId(s.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      currentSessionId === s.id
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {s.title} · {s.status}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleAddNote} className="mt-4 space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="note-content" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Add Research Note (never overwrites prior notes)
                </label>
                <select
                  aria-label="Source provider for note"
                  value={noteProvider}
                  onChange={(e) => setNoteProvider(e.target.value)}
                  className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="Manual Note">Manual Note</option>
                  {data.searchProviders.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                id="note-content"
                rows={3}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Paste or summarize findings from your investigation..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              />
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={noteIsKey}
                    onChange={(e) => setNoteIsKey(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  Highlight as Key Finding
                </label>
                <button
                  type="submit"
                  disabled={!noteContent.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Save Note
                </button>
              </div>
            </form>

            {/* Compare Findings by Provider */}
            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Research Notes &amp; Provider Comparison ({filteredNotes.length})
                </h3>
                {noteProviders.length > 1 && (
                  <select
                    aria-label="Compare notes by provider"
                    value={compareProviderFilter}
                    onChange={(e) => setCompareProviderFilter(e.target.value)}
                    className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                  >
                    <option value="all">Compare All Providers</option>
                    {noteProviders.map((pn) => (
                      <option key={pn} value={pn}>
                        {pn}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {filteredNotes.length === 0 ? (
                <p className="text-xs text-slate-500">No research notes saved yet.</p>
              ) : (
                <div className="space-y-3">
                  {filteredNotes.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3.5"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {n.providerName}
                          {n.isKeyFinding ? ' · Key Finding' : ''}
                        </span>
                        <span>
                          {n.createdDeviceName} · {formatShortDate(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {n.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Key Findings & Final Conclusion */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Key Findings &amp; Conclusion
            </h2>

            <form onSubmit={handleAddKeyFinding} className="flex gap-2">
              <input
                type="text"
                value={newFinding}
                onChange={(e) => setNewFinding(e.target.value)}
                placeholder="Add concise key takeaway..."
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
              />
              <button
                type="submit"
                disabled={!newFinding.trim()}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Add Finding
              </button>
            </form>

            {selectedQuestion.keyFindings.length > 0 && (
              <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                {selectedQuestion.keyFindings.map((f, idx) => (
                  <li key={`${idx}-${f.slice(0, 12)}`}>{f}</li>
                ))}
              </ul>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <label htmlFor="question-conclusion" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Synthesis / Conclusion
              </label>
              <textarea
                id="question-conclusion"
                rows={3}
                value={conclusionDraft ?? selectedQuestion.conclusion}
                onChange={(e) => setConclusionDraft(e.target.value)}
                placeholder="Write your synthesized answer once you've reviewed your sources..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              />
              {conclusionDraft !== null && (
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveConclusion}
                    className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    Save Conclusion
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Saved Resources, Attachments, Related Questions, Device History */}
        <div className="space-y-6">
          {/* Saved URLs & References */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Saved URLs &amp; References ({resources.length})
            </h2>
            <form onSubmit={handleAddResource} className="space-y-2">
              <input
                type="text"
                value={resTitle}
                onChange={(e) => setResTitle(e.target.value)}
                placeholder="Resource title"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
              />
              <input
                type="url"
                value={resUrl}
                onChange={(e) => setResUrl(e.target.value)}
                placeholder="https://..."
                required
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
              />
              <div className="flex gap-2">
                <select
                  aria-label="Resource type"
                  value={resType}
                  onChange={(e) => setResType(e.target.value as ResearchResource['resourceType'])}
                  className="flex-1 min-w-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="article">Article</option>
                  <option value="paper">Paper</option>
                  <option value="reference">Reference</option>
                  <option value="video">Video</option>
                  <option value="ai_thread">AI Thread</option>
                </select>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-3 py-1.5 text-xs font-medium"
                >
                  Save URL
                </button>
              </div>
            </form>

            {resources.length > 0 && (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800 pt-2">
                {resources.map((r) => (
                  <li key={r.id} className="py-2 text-xs">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400 hover:underline break-all"
                    >
                      <span>{r.title}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                    <span className="block text-[11px] text-slate-500 mt-0.5">{r.resourceType}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Attachments */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Attachments ({attachments.length})
              </h2>
              <label className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline">
                <ImagePlus className="w-3.5 h-3.5" />
                <span>Add Image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => handleAddAttachment(e.target.files)}
                />
              </label>
            </div>
            {attachments.length === 0 ? (
              <p className="text-xs text-slate-500">No images attached.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {attachments.map((att) => (
                  <div key={att.id} className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <img src={att.dataUrl} alt={att.fileName} className="w-full h-24 object-cover" />
                    <p className="p-1.5 text-[11px] truncate text-slate-600 dark:text-slate-400">{att.fileName}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Related Questions */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-slate-400" />
              Related Questions ({relatedLinks.length})
            </h2>
            {otherQuestions.length > 0 && (
              <form onSubmit={handleLinkRelated} className="space-y-2">
                <select
                  aria-label="Choose related question"
                  value={relatedTargetId || otherQuestions[0]?.id || ''}
                  onChange={(e) => setRelatedTargetId(e.target.value)}
                  className="w-full min-w-0 truncate rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                >
                  {otherQuestions.map((oq) => (
                    <option key={oq.id} value={oq.id}>
                      {oq.title.slice(0, 60)}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <select
                    aria-label="Relationship type"
                    value={relatedKind}
                    onChange={(e) => setRelatedKind(e.target.value as RelatedQuestion['relationship'])}
                    className="flex-1 min-w-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                  >
                    <option value="follow_up">Follow-up</option>
                    <option value="prerequisite">Prerequisite</option>
                    <option value="related">Related</option>
                    <option value="contradicts">Contradicts</option>
                  </select>
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Link
                  </button>
                </div>
              </form>
            )}
            {relatedLinks.length > 0 && (
              <ul className="space-y-1.5 pt-1">
                {relatedLinks.map((rl) => {
                  const target = activeQuestions.find((q) => q.id === rl.relatedQuestionId);
                  return (
                    <li key={rl.id} className="text-xs">
                      <Link
                        to={`/workspace/${rl.relatedQuestionId}`}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                      >
                        {target?.title ?? 'Question'}
                      </Link>
                      <span className="text-slate-500 ml-1.5">({rl.relationship.replace('_', ' ')})</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Question Device Origin & Audit History */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-400" />
              Device History ({historyEvents.length})
            </h2>
            <ul className="space-y-2 text-xs">
              {historyEvents.slice(0, 10).map((ev) => (
                <li key={ev.id} className="border-b border-slate-100 dark:border-slate-800 pb-2 last:border-b-0">
                  <p className="font-medium text-slate-800 dark:text-slate-200">{ev.summary}</p>
                  <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                    {ev.action} · {ev.deviceName} · {new Date(ev.timestamp).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};
