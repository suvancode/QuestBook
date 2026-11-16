import React, { useState } from 'react';
import { Download, Upload, ShieldCheck, AlertTriangle } from 'lucide-react';
import { QuestBookSnapshot } from '../hooks/useQuestBookData';
import { QuestBookRepo } from '../db/repository';
import { useToast } from '../components/ToastProvider';

export const BackupRecoveryPage: React.FC<{ data: QuestBookSnapshot }> = ({ data }) => {
  const { showToast } = useToast();
  const [backupPassword, setBackupPassword] = useState('');
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreFileText, setRestoreFileText] = useState<string | null>(null);
  const [restoreFileName, setRestoreFileName] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleCreateQbk = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { fileName, archiveString, record } = await QuestBookRepo.createManualQbkBackup(backupPassword);
      const blob = new Blob([archiveString], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      setBackupPassword('');
      showToast(
        'Encrypted .qbk backup created',
        `Verified SHA-256 ${record.checksumSha256.slice(0, 12)}... (${record.questionCount} questions)`,
        'success',
      );
    } catch (err) {
      showToast('Backup failed', err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSelectRestoreFile = async (files: FileList | null) => {
    setRestoreError(null);
    const file = files?.[0];
    if (!file) return;
    setRestoreFileName(file.name);
    const text = await file.text();
    setRestoreFileText(text);
  };

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    setRestoreError(null);
    if (!restoreFileText) {
      setRestoreError('Please choose a .qbk backup file first.');
      return;
    }
    setBusy(true);
    try {
      const res = await QuestBookRepo.restoreFromQbkBackup(restoreFileText, restorePassword);
      setRestorePassword('');
      setRestoreFileText(null);
      setRestoreFileName('');
      showToast(
        'Backup restored & verified',
        `Restored ${res.questionsRestored} question(s) and ${res.attachmentsRestored} attachment(s).`,
        'success',
      );
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Restore failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleAutoPeerSnapshot = async () => {
    const trusted = data.devices.filter((d) => d.trustStatus === 'trusted');
    const targetName = trusted[0]?.name ?? 'Local Snapshot Staging (awaiting peer transfer)';
    const key = data.localSecret?.libraryMasterKeyHex ?? 'questbook-snapshot-key';
    const rec = await QuestBookRepo.createAutoPeerSnapshot(targetName, key);
    showToast('Verified snapshot created', `SHA-256 ${rec.checksumSha256.slice(0, 12)}...`, 'success');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Backup &amp; Recovery</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Synchronization is not backup. Export Argon2id + XChaCha20-Poly1305 encrypted .qbk archives to USB, external drive, or NAS.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Manual Encrypted .qbk Export */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Create Encrypted .qbk Archive
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Includes all questions, categories, tags, research sessions, notes, saved references, attachments, and device origin history. Never store your only backup on the same device.
          </p>

          <form onSubmit={handleCreateQbk} className="space-y-3">
            <div>
              <label htmlFor="backup-password" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Recovery Password (min 8 characters)
              </label>
              <input
                id="backup-password"
                type="password"
                minLength={8}
                required
                value={backupPassword}
                onChange={(e) => setBackupPassword(e.target.value)}
                placeholder="Enter strong recovery passphrase..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Encrypt &amp; Download .qbk
            </button>
          </form>
        </section>

        {/* Restore from .qbk Archive */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Verify &amp; Restore from .qbk Archive
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Validates Argon2id key derivation, XChaCha20-Poly1305 authentication tag, and SHA-256 payload digest before writing to IndexedDB.
          </p>

          <form onSubmit={handleRestore} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Select .qbk Backup File
              </label>
              <input
                type="file"
                accept=".qbk,application/octet-stream,application/json"
                onChange={(e) => handleSelectRestoreFile(e.target.files)}
                className="block w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:rounded-lg file:border file:border-slate-300 dark:file:border-slate-700 file:bg-slate-50 dark:file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-medium"
              />
              {restoreFileName && (
                <p className="mt-1 text-[11px] text-slate-500">Selected: {restoreFileName}</p>
              )}
            </div>
            <div>
              <label htmlFor="restore-password" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Recovery Password
              </label>
              <input
                id="restore-password"
                type="password"
                required
                value={restorePassword}
                onChange={(e) => setRestorePassword(e.target.value)}
                placeholder="Enter recovery password used during export..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>

            {restoreError && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-800 dark:text-rose-200">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{restoreError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              Verify &amp; Restore
            </button>
          </form>
        </section>
      </div>

      {/* Automatic Peer Snapshot & Retention History */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Backup History &amp; Peer Snapshots ({data.backups.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Retention policy: Latest always + {data.preferences.retentionDaily} daily · {data.preferences.retentionWeekly} weekly · {data.preferences.retentionMonthly} monthly
            </p>
          </div>
          <button
            type="button"
            onClick={handleAutoPeerSnapshot}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Create Verified Snapshot Now
          </button>
        </div>

        {data.backups.length === 0 ? (
          <p className="text-xs text-slate-500">No backups recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            {data.backups.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{b.fileName}</p>
                  <p className="text-slate-500 mt-0.5">
                    {b.targetDescription} · {b.questionCount} questions · {Math.round(b.sizeBytes / 1024)} KB · SHA-256{' '}
                    <span className="font-mono">{b.checksumSha256.slice(0, 12)}</span>
                  </p>
                </div>
                <span className="font-mono text-[11px] tabular-nums text-slate-500">
                  {new Date(b.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
