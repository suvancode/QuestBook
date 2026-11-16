import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEncryptedBackup,
  decryptAndVerifyBackup,
  evaluateBackupRetention,
  QuestBookArchivePayload,
} from './backup';
import { BackupRecord } from '../types/questbook';

function samplePayload(): QuestBookArchivePayload {
  return {
    schemaVersion: 2,
    exportedAt: 1700000000000,
    exportedByDeviceId: 'dev-1',
    exportedByDeviceName: 'Workstation',
    questions: [
      {
        id: 'q-1',
        title: 'How does Argon2id resist GPU cracking?',
        description: 'Memory-hard KDF analysis',
        categoryId: 'cat-sec',
        priority: 'high',
        status: 'exploring',
        sourceType: 'text',
        isPinned: true,
        isFavorite: true,
        conclusion: '',
        keyFindings: ['Uses configurable memory cost parameter m'],
        revision: 2,
        versionVector: { 'dev-1': 2 },
        createdAt: 1000,
        updatedAt: 2000,
        archivedAt: null,
        deletedAt: null,
        lastResearchedAt: 2000,
        createdDeviceId: 'dev-1',
        createdDeviceName: 'Workstation',
        lastModifiedDeviceId: 'dev-1',
        lastSyncedFromDeviceId: null,
        lastSyncedFromDeviceName: null,
        lastSyncedAt: null,
      },
    ],
    categories: [{ id: 'cat-sec', name: 'Cybersecurity', description: '', isDefault: true, createdAt: 1, updatedAt: 1, deletedAt: null }],
    tags: [],
    questionTags: [],
    attachments: [],
    researchSessions: [],
    researchNotes: [],
    researchResources: [],
    relatedQuestions: [],
    reminders: [],
    searchProviders: [],
    researchActivities: [],
    devices: [],
    questionDeviceHistory: [],
  };
}

test('.qbk encrypted archive round-trips, verifies integrity, and rejects wrong password or tampering', () => {
  const payload = samplePayload();
  const { archiveString } = createEncryptedBackup(payload, 'strong-recovery-key');

  const restored = decryptAndVerifyBackup(archiveString, 'strong-recovery-key');
  assert.equal(restored.questions.length, 1);
  assert.equal(restored.questions[0].title, 'How does Argon2id resist GPU cracking?');

  assert.throws(() => decryptAndVerifyBackup(archiveString, 'wrong-password'));

  // Tamper ciphertext byte
  const parsed = JSON.parse(archiveString);
  parsed.cipherHex = 'ff' + parsed.cipherHex.slice(2);
  assert.throws(() => decryptAndVerifyBackup(JSON.stringify(parsed), 'strong-recovery-key'));
});

test('evaluateBackupRetention retains latest and prunes excess daily backups', () => {
  const now = Date.UTC(2026, 10, 16, 12, 0, 0);
  const day = 24 * 60 * 60 * 1000;
  const records: BackupRecord[] = Array.from({ length: 12 }, (_, idx) => ({
    id: `b-${idx}`,
    kind: 'auto_peer_snapshot',
    fileName: `snap-${idx}.qbk`,
    targetDescription: 'Peer Device',
    checksumSha256: 'abc',
    sizeBytes: 100,
    questionCount: 5,
    attachmentCount: 0,
    status: 'verified',
    createdAt: now - idx * day,
  }));

  const { keepIds, pruneIds } = evaluateBackupRetention(
    records,
    { dailyCount: 7, weeklyCount: 0, monthlyCount: 0 },
    now,
  );
  assert.equal(keepIds.has('b-0'), true);
  assert.equal(keepIds.size, 7);
  assert.equal(pruneIds.length, 5);
});
