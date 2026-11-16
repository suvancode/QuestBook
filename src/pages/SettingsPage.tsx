import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Check, Lock, Database } from 'lucide-react';
import { QuestBookSnapshot } from '../hooks/useQuestBookData';
import { QuestBookRepo, uuid } from '../db/repository';
import { db } from '../db/database';
import { validateProviderUrlTemplate } from '../core/urlLauncher';
import { useToast } from '../components/ToastProvider';
import { ProviderType, QuestionPriority, SearchProvider } from '../types/questbook';

export const SettingsPage: React.FC<{ data: QuestBookSnapshot }> = ({ data }) => {
  const { showToast } = useToast();
  const prefs = data.preferences;

  // Custom provider form state
  const [provName, setProvName] = useState('');
  const [provType, setProvType] = useState<ProviderType>('custom');
  const [provUrl, setProvUrl] = useState('');
  const [provError, setProvError] = useState<string | null>(null);

  // App lock form
  const [lockPin, setLockPin] = useState('');

  // Storage usage
  const [storageInfo, setStorageInfo] = useState<{ usageMB: string; quotaMB: string } | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);

  useEffect(() => {
    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then((est) => {
        setStorageInfo({
          usageMB: ((est.usage ?? 0) / (1024 * 1024)).toFixed(2),
          quotaMB: ((est.quota ?? 0) / (1024 * 1024)).toFixed(0),
        });
      });
    }
  }, [data.questions.length, data.attachments.length]);

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setProvError(null);
    const validation = validateProviderUrlTemplate(provUrl);
    if (!validation.valid) {
      setProvError(validation.error ?? 'Invalid URL template.');
      return;
    }
    const maxOrder = data.searchProviders.reduce((m, p) => Math.max(m, p.displayOrder), 0);
    const provider: SearchProvider = {
      id: `custom-${uuid().slice(0, 8)}`,
      name: provName.trim(),
      type: provType,
      urlTemplate: provUrl.trim(),
      homepageUrl: new URL(provUrl.trim().replaceAll('{query}', 'test')).origin,
      iconKey: 'globe',
      enabled: true,
      isDefault: false,
      isBuiltIn: false,
      displayOrder: maxOrder + 1,
      updatedAt: Date.now(),
    };
    await QuestBookRepo.saveSearchProvider(provider);
    setProvName('');
    setProvUrl('');
    showToast('Custom provider added', provider.name, 'success');
  };

  const handleMoveProvider = async (provider: SearchProvider, dir: -1 | 1) => {
    const sorted = [...data.searchProviders].sort((a, b) => a.displayOrder - b.displayOrder);
    const idx = sorted.findIndex((p) => p.id === provider.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    await db.searchProviders.update(provider.id, { displayOrder: other.displayOrder });
    await db.searchProviders.update(other.id, { displayOrder: provider.displayOrder });
  };

  const handleEnableAppLock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await QuestBookRepo.setAppLockPasscode(lockPin);
      setLockPin('');
      showToast('App Lock enabled', 'Passcode protected with Argon2id.', 'success');
    } catch (err) {
      showToast('Invalid passcode', err instanceof Error ? err.message : 'Error', 'error');
    }
  };

  const handleExportJson = async () => {
    const payload = await QuestBookRepo.buildArchivePayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `questbook-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('JSON exported', `${payload.questions.length} question(s) exported.`, 'success');
  };

  const handleSeedBenchmark = async (count: number) => {
    const secret = await QuestBookRepo.getLocalSecret();
    const now = Date.now();
    const batch = Array.from({ length: count }, (_, i) => ({
      id: uuid(),
      title: `Benchmark curiosity question #${i + 1}: How does local indexing scale at ${count} records?`,
      description: 'Generated locally for IndexedDB & search latency benchmarking.',
      categoryId: 'cat-technology',
      priority: (i % 3 === 0 ? 'high' : i % 2 === 0 ? 'medium' : 'low') as QuestionPriority,
      status: 'unexplored' as const,
      sourceType: 'text' as const,
      isPinned: false,
      isFavorite: false,
      conclusion: '',
      keyFindings: [],
      revision: 1,
      versionVector: { [secret.deviceId]: 1 },
      createdAt: now - i * 1000,
      updatedAt: now - i * 1000,
      archivedAt: null,
      deletedAt: null,
      lastResearchedAt: null,
      createdDeviceId: secret.deviceId,
      createdDeviceName: secret.deviceName,
      lastModifiedDeviceId: secret.deviceId,
      lastSyncedFromDeviceId: null,
      lastSyncedFromDeviceName: null,
      lastSyncedAt: null,
    }));
    await db.questions.bulkPut(batch);
    showToast(`Added ${count} benchmark questions`, 'Indexed locally in IndexedDB.', 'success');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Preferences are stored locally in IndexedDB. No settings are uploaded to any server.
        </p>
      </div>

      {/* General & Capture */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">General &amp; Capture</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="set-app-name" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Workspace Name
            </label>
            <input
              id="set-app-name"
              type="text"
              value={prefs.appName}
              onChange={(e) => QuestBookRepo.updatePreferences({ appName: e.target.value || 'QuestBook' })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label htmlFor="set-theme" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Theme
            </label>
            <select
              id="set-theme"
              value={prefs.theme}
              onChange={(e) =>
                QuestBookRepo.updatePreferences({ theme: e.target.value as 'light' | 'dark' | 'system' })
              }
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>
          <div>
            <label htmlFor="set-default-prio" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Default Priority
            </label>
            <select
              id="set-default-prio"
              value={prefs.defaultPriority}
              onChange={(e) =>
                QuestBookRepo.updatePreferences({ defaultPriority: e.target.value as QuestionPriority })
              }
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </section>

      {/* External Research Providers & Custom Provider Manager */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Search &amp; Custom Research Providers
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Choose any default provider, toggle enabled state for Search All, reorder, or add custom URL templates with <code>{'{query}'}</code>.
          </p>
        </div>

        <form onSubmit={handleAddProvider} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <input
            type="text"
            value={provName}
            onChange={(e) => setProvName(e.target.value)}
            placeholder="Provider name (e.g. Wikipedia)"
            required
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
          />
          <select
            aria-label="Provider type"
            value={provType}
            onChange={(e) => setProvType(e.target.value as ProviderType)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
          >
            <option value="custom">Custom Website</option>
            <option value="search_engine">Search Engine</option>
            <option value="ai_assistant">AI Assistant</option>
            <option value="encyclopedia">Encyclopedia</option>
            <option value="academic">Academic</option>
          </select>
          <input
            type="text"
            value={provUrl}
            onChange={(e) => setProvUrl(e.target.value)}
            placeholder="https://en.wikipedia.org/w/index.php?search={query}"
            required
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Provider
          </button>
        </form>

        {provError && (
          <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
            {provError}
          </p>
        )}

        <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          {data.searchProviders.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-xs">
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</span>
                <span className="text-slate-500 ml-2 font-mono text-[11px] break-all">{p.urlTemplate}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleMoveProvider(p, -1)}
                  aria-label={`Move ${p.name} up`}
                  className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveProvider(p, 1)}
                  aria-label={`Move ${p.name} down`}
                  className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => QuestBookRepo.setDefaultProvider(p.id)}
                  className={`px-2.5 py-1 rounded border text-xs font-medium ${
                    p.isDefault
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {p.isDefault ? 'Default' : 'Set Default'}
                </button>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    onChange={(e) => QuestBookRepo.saveSearchProvider({ ...p, enabled: e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  <span>Enabled</span>
                </label>
                {!p.isBuiltIn && (
                  <button
                    type="button"
                    onClick={() => QuestBookRepo.deleteCustomProvider(p.id)}
                    aria-label={`Delete ${p.name}`}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Security & Encryption */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Security &amp; Local Encryption</h2>
        </div>

        <label className="flex items-start gap-2.5 text-xs">
          <input
            type="checkbox"
            checked={prefs.localEncryptionEnabled}
            onChange={(e) => QuestBookRepo.updatePreferences({ localEncryptionEnabled: e.target.checked })}
            className="mt-0.5 rounded border-slate-300 text-indigo-600"
          />
          <span>
            <strong className="text-slate-900 dark:text-slate-100">Encrypt sensitive question fields at rest (XChaCha20-Poly1305)</strong>
            <span className="block text-slate-500 mt-0.5">
              Browser IndexedDB is not encrypted by default. Enabling this wraps titles, descriptions, and conclusions using your device&apos;s library master key.
            </span>
          </span>
        </label>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          {prefs.appLockEnabled ? (
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                <Check className="w-4 h-4" />
                App Lock is active (Argon2id passcode)
              </span>
              <button
                type="button"
                onClick={() => QuestBookRepo.disableAppLock()}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Disable App Lock
              </button>
            </div>
          ) : (
            <form onSubmit={handleEnableAppLock} className="flex flex-wrap items-center gap-2">
              <input
                type="password"
                minLength={4}
                required
                value={lockPin}
                onChange={(e) => setLockPin(e.target.value)}
                placeholder="Set App Lock passcode (min 4 chars)..."
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
              />
              <button
                type="submit"
                className="rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-3.5 py-1.5 text-xs font-medium"
              >
                Enable App Lock
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Sync & WebRTC Infrastructure */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Sync Transport &amp; WebRTC STUN/TURN
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-slate-600 dark:text-slate-400 mb-1">Python Local Companion URL</label>
            <input
              type="text"
              value={prefs.localCompanionUrl}
              onChange={(e) => QuestBookRepo.updatePreferences({ localCompanionUrl: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-600 dark:text-slate-400 mb-1">Optional TURN Relay URL (for strict NAT)</label>
            <input
              type="text"
              value={prefs.turnServerUrl}
              onChange={(e) => QuestBookRepo.updatePreferences({ turnServerUrl: e.target.value })}
              placeholder="turn:your-turn-server.example:3478"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 font-mono"
            />
          </div>
        </div>
      </section>

      {/* Data Management & Storage */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-500" />
            Data Management &amp; Local Storage
          </h2>
          {storageInfo && (
            <span className="font-mono text-xs tabular-nums text-slate-500">
              {storageInfo.usageMB} MB / {storageInfo.quotaMB} MB browser quota
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportJson}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Export Unencrypted JSON
          </button>
          <button
            type="button"
            onClick={() => handleSeedBenchmark(100)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Seed +100 Benchmark Questions
          </button>
          {!confirmWipe ? (
            <button
              type="button"
              onClick={() => setConfirmWipe(true)}
              className="rounded-lg border border-rose-300 dark:border-rose-800 px-3.5 py-2 text-xs font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            >
              Delete All Local Data
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await QuestBookRepo.wipeAllLocalData();
                  setConfirmWipe(false);
                  showToast('Local database reset', 'Fresh device identity initialized.', 'info');
                }}
                className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-rose-700"
              >
                Confirm Complete Wipe
              </button>
              <button
                type="button"
                onClick={() => setConfirmWipe(false)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
