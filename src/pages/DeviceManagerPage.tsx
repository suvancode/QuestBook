import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, ShieldAlert, Check, Laptop, Smartphone, Tablet, Trash2, Edit2 } from 'lucide-react';
import { QuestBookSnapshot } from '../hooks/useQuestBookData';
import { QuestBookRepo } from '../db/repository';
import { PairingQRData, syncService } from '../services/syncClient';
import { useToast } from '../components/ToastProvider';
import { formatShortDate } from '../components/QuestionRow';

export const DeviceManagerPage: React.FC<{ data: QuestBookSnapshot }> = ({ data }) => {
  const { showToast } = useToast();
  const [qrPayload, setQrPayload] = useState<PairingQRData | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string>('');
  const [incomingRequest, setIncomingRequest] = useState<PairingQRData | null>(null);
  const [pastePairingText, setPastePairingText] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    const unsub = syncService.subscribe((ev) => {
      if (ev.type === 'pair_request') {
        setIncomingRequest(ev.detail as PairingQRData);
      } else if (ev.type === 'pair_error') {
        showToast('Pairing rejected', String(ev.detail), 'error');
      }
    });
    return unsub;
  }, [showToast]);

  const handleGenerateQR = async () => {
    const qr = await syncService.generatePairingQR();
    const json = JSON.stringify(qr);
    const dataUrl = await QRCode.toDataURL(json, { width: 240, margin: 1 });
    setQrPayload(qr);
    setQrImageUrl(dataUrl);
    showToast('Single-use pairing QR generated', 'Expires in 5 minutes.', 'info');
  };

  const handlePairFromCode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const paired = await syncService.initiatePairingFromQR(pastePairingText.trim());
      setPastePairingText('');
      showToast('Device paired', `${paired.name} is now a trusted peer.`, 'success');
    } catch (err) {
      showToast('Pairing failed', err instanceof Error ? err.message : 'Invalid pairing payload', 'error');
    }
  };

  const handleConfirmIncoming = async () => {
    if (!incomingRequest) return;
    const paired = await syncService.confirmIncomingPairing(incomingRequest);
    setIncomingRequest(null);
    setQrPayload(null);
    showToast('Pairing confirmed', `${paired.name} added to trusted devices.`, 'success');
  };

  const handleRevoke = async (deviceId: string, name: string) => {
    try {
      const res = await QuestBookRepo.revokeDeviceAndRotateKeys(deviceId);
      showToast(
        `Revoked ${name}`,
        `Rotated library encryption key to v${res.newKeyVersion} for ${res.rewrappedCount} trusted peer(s).`,
        'info',
      );
    } catch (err) {
      showToast('Cannot revoke', err instanceof Error ? err.message : 'Error', 'error');
    }
  };

  const handleRenameSubmit = async (deviceId: string) => {
    if (!renameValue.trim()) return;
    await QuestBookRepo.renameDevice(deviceId, renameValue);
    setRenamingId(null);
    showToast('Device renamed', renameValue.trim(), 'success');
  };

  const selfDevice = data.devices.find((d) => d.trustStatus === 'self');
  const peerDevices = data.devices.filter((d) => d.trustStatus !== 'self');

  const DeviceIcon = ({ type }: { type: string }) => {
    if (type === 'mobile') return <Smartphone className="w-4 h-4 text-slate-500" />;
    if (type === 'tablet') return <Tablet className="w-4 h-4 text-slate-500" />;
    return <Laptop className="w-4 h-4 text-slate-500" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Device Manager</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Cryptographic Ed25519 + X25519 device identities for cloudless peer-to-peer synchronization.
        </p>
      </div>

      {/* Self Device Card */}
      {selfDevice && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">This Device</span>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">{selfDevice.name}</h2>
              <p className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-1 break-all">
                Fingerprint: {selfDevice.fingerprint}
              </p>
              <p className="font-mono text-[11px] text-slate-400 mt-0.5">
                Device ID: {selfDevice.id} · Key v{selfDevice.keyVersion}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {renamingId === selfDevice.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    placeholder="Device name"
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => handleRenameSubmit(selfDevice.id)}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setRenamingId(selfDevice.id);
                    setRenameValue(selfDevice.name);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Rename This Device
                </button>
              )}
              <button
                type="button"
                onClick={handleGenerateQR}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
              >
                <QrCode className="w-4 h-4" />
                Add New Device (QR)
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Incoming Pairing Confirmation Banner */}
      {incomingRequest && (
        <section className="rounded-xl border border-indigo-400 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Verify Incoming Device Pairing Request
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            Confirm that the fingerprint below matches the device requesting to join:
          </p>
          <div className="mt-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 text-xs">
            <p className="font-semibold text-slate-900 dark:text-slate-100">{incomingRequest.deviceName}</p>
            <p className="font-mono text-slate-600 dark:text-slate-400 mt-0.5">
              Fingerprint: {incomingRequest.fingerprint}
            </p>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleConfirmIncoming}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
            >
              <Check className="w-3.5 h-3.5" />
              Trust &amp; Pair Device
            </button>
            <button
              type="button"
              onClick={() => setIncomingRequest(null)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-medium"
            >
              Reject
            </button>
          </div>
        </section>
      )}

      {/* QR Generator + Manual Pair Input */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Show Pairing QR on This Device
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tokens are single-use, expire after 5 minutes, and never contain your database or private keys.
          </p>
          {qrPayload && qrImageUrl ? (
            <div className="flex flex-col sm:flex-row items-start gap-4 pt-2">
              <img
                src={qrImageUrl}
                alt="QuestBook single-use device pairing QR code"
                className="w-44 h-44 rounded-lg border border-slate-200 dark:border-slate-700 bg-white p-2"
              />
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Expires: <span className="tabular-nums">{new Date(qrPayload.expiresAt).toLocaleTimeString()}</span>
                </p>
                <textarea
                  readOnly
                  rows={4}
                  value={JSON.stringify(qrPayload)}
                  aria-label="Pairing payload JSON"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 font-mono text-[11px]"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(JSON.stringify(qrPayload));
                    showToast('Pairing payload copied', 'Paste this on your second device or browser tab.', 'info');
                  }}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Copy Pairing Payload
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGenerateQR}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Generate Expiring QR Code
            </button>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Pair With Another Device
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Paste the pairing payload copied from another QuestBook tab or device to exchange public keys and verify fingerprints.
          </p>
          <form onSubmit={handlePairFromCode} className="space-y-3">
            <textarea
              rows={4}
              value={pastePairingText}
              onChange={(e) => setPastePairingText(e.target.value)}
              placeholder='Paste pairing JSON payload here {"v":1,"token":...}'
              required
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono text-xs"
            />
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              Verify &amp; Pair Device
            </button>
          </form>
        </section>
      </div>

      {/* Paired & Revoked Devices */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Paired Devices ({peerDevices.length})
          </h2>
        </div>

        {peerDevices.length === 0 ? (
          <p className="p-6 text-xs text-slate-500 dark:text-slate-400">
            No remote devices paired yet. Open QuestBook on another device or browser profile and pair via QR.
          </p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {peerDevices.map((dev) => (
              <div key={dev.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <DeviceIcon type={dev.deviceType} />
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{dev.name}</span>
                    <span
                      className={`text-xs font-medium ${
                        dev.trustStatus === 'revoked'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      · {dev.trustStatus === 'revoked' ? 'Revoked' : 'Trusted'}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-slate-500 truncate">Fingerprint: {dev.fingerprint}</p>
                  <p className="text-xs text-slate-500 tabular-nums">
                    Paired {formatShortDate(dev.pairedAt)} · Last sync:{' '}
                    {dev.lastSyncedAt ? new Date(dev.lastSyncedAt).toLocaleString() : 'Never'} · Received{' '}
                    {dev.questionsReceivedCount} question(s)
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {dev.trustStatus !== 'revoked' && (
                    <button
                      type="button"
                      onClick={() => handleRevoke(dev.id, dev.name)}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-300 dark:border-amber-800 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Revoke &amp; Rotate Keys
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => QuestBookRepo.removeDevice(dev.id)}
                    aria-label={`Remove ${dev.name}`}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Lost Device Guidance & Device Activity Log */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Device Activity &amp; Key Rotation History
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Note: Revoking a lost or stolen device rejects all future sync connections and rotates your library key for remaining peers, though it cannot remotely erase data already copied onto the offline lost device.
        </p>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.deviceHistory.slice(0, 12).map((ev) => (
            <div key={ev.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-medium text-slate-800 dark:text-slate-200">{ev.deviceName}</span>
                <span className="text-slate-500 mx-1.5">·</span>
                <span className="text-slate-600 dark:text-slate-400">{ev.details}</span>
              </div>
              <span className="font-mono text-[11px] tabular-nums text-slate-400">
                {new Date(ev.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
