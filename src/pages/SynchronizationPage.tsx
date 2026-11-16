import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Wifi, AlertTriangle, CheckCircle2, Radio } from 'lucide-react';
import { QuestBookSnapshot } from '../hooks/useQuestBookData';
import { syncService } from '../services/syncClient';
import { QuestBookRepo } from '../db/repository';
import { useToast } from '../components/ToastProvider';

export const SynchronizationPage: React.FC<{ data: QuestBookSnapshot }> = ({ data }) => {
  const { showToast } = useToast();
  const [connected, setConnected] = useState(syncService.isConnected());
  const [onlinePeerIds, setOnlinePeerIds] = useState<string[]>(() => syncService.getOnlinePeerIds());
  const [endpointUrl, setEndpointUrl] = useState(() => data.preferences.signalingUrl || syncService.getDefaultRelayUrl());
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [customMergeMap, setCustomMergeMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsub = syncService.subscribe((ev) => {
      if (ev.type === 'status') {
        const s = ev.detail as { connected: boolean };
        setConnected(s.connected);
      } else if (ev.type === 'peers') {
        setOnlinePeerIds(ev.detail as string[]);
      } else if (ev.type === 'synced') {
        const res = ev.detail as { message: string };
        showToast('Synchronization update', res.message, 'success');
      } else if (ev.type === 'sync_error') {
        showToast('Sync error', String(ev.detail), 'error');
      }
    });
    return unsub;
  }, [showToast]);

  const trustedPeers = useMemo(
    () => data.devices.filter((d) => d.trustStatus === 'trusted'),
    [data.devices],
  );
  const openConflicts = useMemo(
    () => data.conflicts.filter((c) => !c.resolved),
    [data.conflicts],
  );

  const handleToggleConnect = async () => {
    if (connected) {
      syncService.disconnect();
      return;
    }
    try {
      await syncService.connect(endpointUrl);
      showToast('Connected to zero-knowledge relay', endpointUrl, 'success');
    } catch (err) {
      showToast('Connection failed', err instanceof Error ? err.message : 'Unable to connect', 'error');
    }
  };

  const handleSyncPeer = async (peerId: string, useWebRTC: boolean) => {
    setSyncingId(peerId);
    try {
      const res = await syncService.syncWithPeer(peerId, useWebRTC);
      showToast('Sync completed', res.message, 'success');
    } catch (err) {
      showToast('Sync failed', err instanceof Error ? err.message : 'Unknown error', 'error');
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Synchronization</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          End-to-end encrypted QuestBook Sync Protocol over WebSocket or WebRTC DataChannel. No central database stores your questions.
        </p>
      </div>

      {/* Transport Connection Card */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Radio className={`w-4 h-4 ${connected ? 'text-emerald-600' : 'text-slate-400'}`} />
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Signaling &amp; Relay Transport: {connected ? 'Connected' : 'Disconnected'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Online peers discovered on relay: <span className="font-mono tabular-nums">{onlinePeerIds.length}</span> · Local Change Journal: <span className="font-mono tabular-nums">{data.syncOperations.length}</span> operation(s)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleConnect}
            className={`rounded-lg px-4 py-2 text-xs font-medium text-white ${
              connected ? 'bg-slate-700 hover:bg-slate-800' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {connected ? 'Disconnect' : 'Connect Transport'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label htmlFor="sync-relay-url" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              WebSocket Signaling / Local Companion URL
            </label>
            <input
              id="sync-relay-url"
              type="text"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 font-mono text-xs"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setEndpointUrl(syncService.getDefaultRelayUrl())}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Use Built-in Relay
            </button>
            <button
              type="button"
              onClick={() => setEndpointUrl(data.preferences.localCompanionUrl)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Use Python Companion (:8765)
            </button>
          </div>
        </div>
      </section>

      {/* Conflict Resolution Queue */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${openConflicts.length > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
            Concurrent Edit Conflicts ({openConflicts.length})
          </h2>
        </div>

        {openConflicts.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            No unresolved synchronization conflicts. Causal version vectors are clean.
          </p>
        ) : (
          <div className="space-y-4">
            {openConflicts.map((c) => (
              <div key={c.id} className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-3">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Field &ldquo;{c.field}&rdquo; modified concurrently on {c.localDeviceName} and {c.remoteDeviceName}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                    <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Local Version</div>
                    <p className="text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{c.localValue}</p>
                  </div>
                  <div className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                    <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Remote Version ({c.remoteDeviceName})
                    </div>
                    <p className="text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{c.remoteValue}</p>
                  </div>
                </div>
                <textarea
                  rows={2}
                  value={customMergeMap[c.id] ?? `${c.localValue} / ${c.remoteValue}`}
                  onChange={(e) => setCustomMergeMap((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  aria-label="Custom merged value"
                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2 text-xs"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => QuestBookRepo.resolveConflict(c.id, 'local')}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Keep Local
                  </button>
                  <button
                    type="button"
                    onClick={() => QuestBookRepo.resolveConflict(c.id, 'remote')}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Accept Remote
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      QuestBookRepo.resolveConflict(c.id, 'merged', customMergeMap[c.id] ?? `${c.localValue} / ${c.remoteValue}`)
                    }
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    Save Merged Text
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Trusted Peers Sync Controls */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Trusted Peers ({trustedPeers.length})
          </h2>
        </div>

        {trustedPeers.length === 0 ? (
          <p className="p-6 text-xs text-slate-500">
            No trusted peer devices paired yet. Go to Device Manager to pair a phone, tablet, or laptop.
          </p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {trustedPeers.map((peer) => {
              const isOnline = onlinePeerIds.includes(peer.id);
              const checkpoint = data.syncCheckpoints.find((cp) => cp.peerDeviceId === peer.id);
              const seen = new Set(checkpoint?.lastAckedOperationIds ?? []);
              const pendingCount = data.syncOperations.filter((op) => !seen.has(op.operationId)).length;

              return (
                <div key={peer.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Wifi className={`w-4 h-4 ${isOnline ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{peer.name}</span>
                      <span className="text-xs text-slate-500">
                        · {isOnline ? 'Online on relay' : 'Offline'} ·{' '}
                        <span className="font-mono tabular-nums">{pendingCount}</span> pending op(s)
                      </span>
                    </div>
                    {checkpoint && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Last sync: {checkpoint.lastSyncSummary} ({new Date(checkpoint.updatedAt).toLocaleString()})
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={syncingId === peer.id}
                      onClick={() => handleSyncPeer(peer.id, false)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncingId === peer.id ? 'animate-spin' : ''}`} />
                      Sync via Encrypted Relay
                    </button>
                    <button
                      type="button"
                      disabled={syncingId === peer.id}
                      onClick={() => handleSyncPeer(peer.id, true)}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Try WebRTC P2P
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
