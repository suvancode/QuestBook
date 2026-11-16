import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareVectors,
  computeOperationHash,
  filterMissingOperations,
  incrementVector,
  mergeQuestionOperation,
  mergeResearchNote,
} from './syncEngine';
import { DeviceRecord, Question, ResearchNote, SyncOperation } from '../types/questbook';

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q-100',
    title: 'How do WebRTC data channels establish DTLS?',
    description: 'Check certificate fingerprints in SDP.',
    categoryId: 'cat-tech',
    priority: 'medium',
    status: 'new',
    sourceType: 'text',
    isPinned: false,
    isFavorite: false,
    conclusion: '',
    keyFindings: [],
    revision: 1,
    versionVector: { 'dev-phone': 1 },
    createdAt: 1000,
    updatedAt: 1000,
    archivedAt: null,
    deletedAt: null,
    lastResearchedAt: null,
    createdDeviceId: 'dev-phone',
    createdDeviceName: "Aaditya's Android Phone",
    lastModifiedDeviceId: 'dev-phone',
    lastSyncedFromDeviceId: null,
    lastSyncedFromDeviceName: null,
    lastSyncedAt: null,
    ...overrides,
  };
}

test('3-device sync preserves original createdDeviceId while tracking immediate sender', () => {
  const phone: DeviceRecord = {
    id: 'dev-phone',
    name: "Aaditya's Android Phone",
    deviceType: 'mobile',
    ed25519PublicKey: 'pk1',
    x25519PublicKey: 'xk1',
    fingerprint: 'FP1',
    trustStatus: 'trusted',
    pairedAt: 500,
    lastConnectedAt: 1000,
    lastSyncedAt: 1000,
    questionsCreatedCount: 1,
    questionsReceivedCount: 0,
    keyVersion: 1,
  };
  const laptop: DeviceRecord = {
    ...phone,
    id: 'dev-laptop',
    name: 'Windows Laptop',
    deviceType: 'desktop',
  };

  const qOnPhone = makeQuestion();
  const op1: SyncOperation = {
    operationId: 'op-1',
    entityType: 'question',
    entityId: qOnPhone.id,
    deviceId: phone.id,
    deviceName: phone.name,
    entityRevision: 1,
    baseRevision: 0,
    versionVector: qOnPhone.versionVector,
    operationType: 'create',
    timestamp: 1000,
    payload: qOnPhone as unknown as Record<string, unknown>,
    payloadHash: 'h1',
  };

  // Phone -> Laptop
  const laptopResult = mergeQuestionOperation(undefined, op1, phone, laptop.id);
  assert.equal(laptopResult.merged.createdDeviceId, 'dev-phone');
  assert.equal(laptopResult.merged.createdDeviceName, "Aaditya's Android Phone");
  assert.equal(laptopResult.merged.lastSyncedFromDeviceId, 'dev-phone');

  // Laptop -> Tablet
  const op2: SyncOperation = {
    ...op1,
    operationId: 'op-2',
    deviceId: laptop.id,
    deviceName: laptop.name,
    payload: laptopResult.merged as unknown as Record<string, unknown>,
  };
  const tabletResult = mergeQuestionOperation(undefined, op2, laptop, 'dev-tablet');
  assert.equal(tabletResult.merged.createdDeviceId, 'dev-phone');
  assert.equal(tabletResult.merged.createdDeviceName, "Aaditya's Android Phone");
  assert.equal(tabletResult.merged.lastSyncedFromDeviceId, 'dev-laptop');
  assert.equal(tabletResult.merged.lastSyncedFromDeviceName, 'Windows Laptop');
});

test('concurrent title/description edits create conflict records instead of silent LWW overwrite', () => {
  const localQ = makeQuestion({
    title: 'How does DTLS work in WebRTC?',
    versionVector: { 'dev-phone': 1, 'dev-laptop': 1 },
    updatedAt: 2000,
    lastModifiedDeviceId: 'dev-laptop',
  });

  const remoteQ = makeQuestion({
    title: 'How does WebRTC DTLS + SCTP encryption work?',
    versionVector: { 'dev-phone': 2 },
    updatedAt: 1500, // Even with an older wall-clock timestamp (clock skew)!
    lastModifiedDeviceId: 'dev-phone',
  });

  assert.equal(compareVectors(localQ.versionVector, remoteQ.versionVector), 'concurrent');

  const op: SyncOperation = {
    operationId: 'op-concurrent',
    entityType: 'question',
    entityId: localQ.id,
    deviceId: 'dev-phone',
    deviceName: "Aaditya's Android Phone",
    entityRevision: 2,
    baseRevision: 1,
    versionVector: remoteQ.versionVector,
    operationType: 'update',
    timestamp: 1500,
    payload: remoteQ as unknown as Record<string, unknown>,
    payloadHash: 'h-c',
  };

  const result = mergeQuestionOperation(
    localQ,
    op,
    { id: 'dev-phone', name: "Aaditya's Android Phone", trustStatus: 'trusted' },
    'dev-laptop',
  );

  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].field, 'title');
  assert.equal(result.conflicts[0].localValue, 'How does DTLS work in WebRTC?');
  assert.equal(result.conflicts[0].remoteValue, 'How does WebRTC DTLS + SCTP encryption work?');
});

test('revoked device operations are rejected', () => {
  const q = makeQuestion();
  const op: SyncOperation = {
    operationId: 'op-rev',
    entityType: 'question',
    entityId: q.id,
    deviceId: 'dev-stolen',
    deviceName: 'Lost Phone',
    entityRevision: 1,
    baseRevision: 0,
    versionVector: { 'dev-stolen': 1 },
    operationType: 'create',
    timestamp: 1000,
    payload: q as unknown as Record<string, unknown>,
    payloadHash: 'h-rev',
  };

  assert.throws(() =>
    mergeQuestionOperation(
      undefined,
      op,
      { id: 'dev-stolen', name: 'Lost Phone', trustStatus: 'revoked' },
      'dev-laptop',
    ),
  );
});

test('research notes preserve independent concurrent edits and filterMissingOperations deduplicates', () => {
  const n1: ResearchNote = {
    id: 'n-1',
    questionId: 'q-1',
    sessionId: null,
    providerName: 'Perplexity',
    content: 'Finding from phone.',
    isKeyFinding: true,
    createdAt: 1000,
    updatedAt: 1200,
    createdDeviceId: 'dev-phone',
    createdDeviceName: 'Phone',
    lastModifiedDeviceId: 'dev-phone',
    versionVector: { 'dev-phone': 1 },
    deletedAt: null,
  };
  const n2: ResearchNote = {
    ...n1,
    content: 'Additional citation from laptop.',
    lastModifiedDeviceId: 'dev-laptop',
    createdDeviceName: 'Laptop',
    versionVector: { 'dev-laptop': 1 },
    updatedAt: 1300,
  };

  const mergedNote = mergeResearchNote(n1, n2);
  assert.match(mergedNote.content, /Finding from phone/);
  assert.match(mergedNote.content, /Additional citation from laptop/);

  const baseOp = {
    operationId: 'op-a',
    entityType: 'question' as const,
    entityId: 'q-1',
    deviceId: 'd1',
    deviceName: 'D1',
    entityRevision: 1,
    baseRevision: 0,
    versionVector: incrementVector({}, 'd1'),
    operationType: 'create' as const,
    timestamp: 100,
    payload: { title: 'Test' },
  };
  const fullOp: SyncOperation = { ...baseOp, payloadHash: computeOperationHash(baseOp) };
  const missing = filterMissingOperations([fullOp], new Set(['op-a']));
  assert.equal(missing.length, 0);
});
