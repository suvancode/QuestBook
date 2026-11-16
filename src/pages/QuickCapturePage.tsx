import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mic, MicOff, ImagePlus, Camera, CheckCircle2, AlertTriangle, X, Share2 } from 'lucide-react';
import { QuestBookSnapshot } from '../hooks/useQuestBookData';
import { QuestBookRepo } from '../db/repository';
import { QuestionPriority, SourceType } from '../types/questbook';
import { findPotentialDuplicates } from '../core/search';
import { useToast } from '../components/ToastProvider';

interface QuickCapturePageProps {
  data: QuestBookSnapshot;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export const QuickCapturePage: React.FC<QuickCapturePageProps> = ({ data }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const sharedTitle = searchParams.get('title') ?? '';
  const sharedText = searchParams.get('text') ?? '';
  const sharedUrl = searchParams.get('url') ?? '';
  const hasSharePayload = Boolean(sharedTitle || sharedText || sharedUrl);

  const [title, setTitle] = useState(() => sharedTitle || sharedText || '');
  const [description, setDescription] = useState(() => (sharedTitle && sharedText ? sharedText : ''));
  const [categoryId, setCategoryId] = useState(() => data.preferences.defaultCategoryId || 'cat-general');
  const [priority, setPriority] = useState<QuestionPriority>(() => data.preferences.defaultPriority || 'medium');
  const [tagsInput, setTagsInput] = useState('');
  const [sourceUrl, setSourceUrl] = useState(() => sharedUrl);
  const [sourceType, setSourceType] = useState<SourceType>(() => (hasSharePayload ? 'share' : 'text'));

  const [attachments, setAttachments] = useState<
    Array<{ fileName: string; mimeType: string; size: number; dataUrl: string; caption: string }>
  >([]);

  // Voice capture state
  const [recording, setRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const speechSupported = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const potentialDuplicates = useMemo(
    () => findPotentialDuplicates(title, data.questions, undefined, 0.55),
    [title, data.questions],
  );

  const handleToggleVoice = () => {
    setVoiceError(null);
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechCtor) {
      setVoiceError('Speech recognition is unavailable in this browser or offline context. Type your question manually.');
      return;
    }

    try {
      const rec = new SpeechCtor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setTitle(transcript.trim());
        setSourceType('voice');
      };
      rec.onerror = (err) => {
        setVoiceError(`Voice capture error: ${err.error}. Check microphone permissions or type manually.`);
        setRecording(false);
      };
      rec.onend = () => setRecording(false);
      rec.start();
      recognitionRef.current = rec;
      setRecording(true);
    } catch {
      setVoiceError('Could not access microphone. Verify browser permissions.');
      setRecording(false);
    }
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        showToast('Unsupported file', `${file.name} is not an image file.`, 'error');
        continue;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read image'));
        reader.readAsDataURL(file);
      });
      setAttachments((prev) => [
        ...prev,
        {
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          dataUrl,
          caption: '',
        },
      ]);
      setSourceType('image');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    if (!title.trim()) {
      setValidationError('Please enter a question title before saving.');
      return;
    }
    setSaving(true);
    try {
      const tagNames = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const created = await QuestBookRepo.createQuestion({
        title,
        description,
        categoryId,
        priority,
        sourceType,
        sourceUrl,
        tagNames,
        attachments,
      });

      showToast(
        'Question saved locally',
        `Persisted offline on ${created.createdDeviceName}.`,
        'success',
      );
      navigate(`/workspace/${created.id}`);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to save question.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {hasSharePayload && (
        <div className="flex items-start gap-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 p-4 text-xs text-indigo-900 dark:text-indigo-200">
          <Share2 className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Shared content pre-filled via Web Share Target</p>
            <p className="mt-0.5 opacity-90">Review or edit the question details below and click Save Question.</p>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Quick Capture</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Only a title is required. Saves directly to local IndexedDB even offline.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleVoice}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                recording
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {recording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              {recording ? 'Stop Recording' : 'Voice Capture'}
            </button>

            <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap shrink-0">
              <ImagePlus className="w-3.5 h-3.5" />
              <span>Image / Screenshot</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
            </label>

            <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap shrink-0">
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Camera</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
            </label>
          </div>
        </div>

        {recording && (
          <div className="mt-4 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-800 dark:text-rose-200">
            Listening via microphone... Speak your question clearly, then edit the transcript below if needed.
          </div>
        )}

        {voiceError && (
          <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{voiceError}</span>
          </div>
        )}

        {!speechSupported && (
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
            Note: Browser Web Speech API is unavailable in this environment; manual text input is always available offline.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="capture-title" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Question Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="capture-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., How do zero-knowledge proofs verify identity without revealing secrets?"
              autoFocus
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {potentialDuplicates.length > 0 && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-3 text-xs">
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                Similar question(s) already in your vault:
              </p>
              <ul className="mt-1.5 space-y-1">
                {potentialDuplicates.map((d) => (
                  <li key={d.question.id}>
                    <Link
                      to={`/workspace/${d.question.id}`}
                      className="text-indigo-700 dark:text-indigo-300 hover:underline font-medium"
                    >
                      {d.question.title}
                    </Link>
                    <span className="text-slate-500 ml-2">({Math.round(d.similarity * 100)}% match)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label htmlFor="capture-desc" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Context or Sub-questions (Optional)
            </label>
            <textarea
              id="capture-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Where did this question come up? What do you already know?"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="capture-category" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Category (Optional)
              </label>
              <select
                id="capture-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              >
                {data.categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="capture-priority" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Priority (Optional)
              </label>
              <select
                id="capture-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as QuestionPriority)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label htmlFor="capture-tags" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Tags (Comma-separated)
              </label>
              <input
                id="capture-tags"
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="security, web, thesis"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label htmlFor="capture-url" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Source URL (Optional)
            </label>
            <input
              id="capture-url"
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          {attachments.length > 0 && (
            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Image Attachments ({attachments.length})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {attachments.map((att, idx) => (
                  <div
                    key={`${att.fileName}-${idx}`}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 flex items-start gap-3"
                  >
                    <img
                      src={att.dataUrl}
                      alt={att.fileName}
                      className="w-16 h-16 rounded object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{att.fileName}</p>
                      <input
                        type="text"
                        value={att.caption}
                        onChange={(e) =>
                          setAttachments((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, caption: e.target.value } : item)),
                          )
                        }
                        placeholder="Optional caption..."
                        className="mt-1.5 w-full rounded border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1 text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label={`Remove ${att.fileName}`}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {validationError && (
            <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
              {validationError}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              {saving ? 'Saving Locally...' : 'Save Question'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
