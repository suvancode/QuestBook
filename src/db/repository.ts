import { db, LocalDeviceSecret } from './database';
import {
  Attachment,
  BackupRecord,
  Category,
  ConflictRecord,
  DeviceHistoryEvent,
  DeviceRecord,
  GeneralPreferences,
  Question,
  QuestionDeviceHistoryEvent,
  QuestionHistoryAction,
  QuestionPriority,
  QuestionStatus,
  RelatedQuestion,
  Reminder,
  ResearchActivity,
  ResearchActivityStatus,
  ResearchNote,
  ResearchResource,
  ResearchSession,
  SearchProvider,
  SourceType,
  SyncEntityType,
  SyncOperation,
  SyncOperationType,
  Tag,
} from '../types/questbook';
import {
  bytesToHex,
  decryptText,
  derivePasswordKey,
  encryptText,
  generateDeviceKeyMaterial,
  generateRandomKeyHex,
  hexToBytes,
  randomBytes,
  sha256Hex,
  signPayload,
  wrapLibraryKeyForPeer,
} from '../core/crypto';
import { BUILT_IN_PROVIDERS, validateProviderUrlTemplate } from '../core/urlLauncher';
import {
  computeOperationHash,
  incrementVector,
  mergeQuestionOperation,
  mergeResearchNote,
} from '../core/syncEngine';
import {
  createEncryptedBackup,
  decryptAndVerifyBackup,
  evaluateBackupRetention,
  QuestBookArchivePayload,
} from '../core/backup';

export const DEFAULT_CATEGORIES: Array<{ id: string; name: string; description: string }> = [
  { id: 'cat-technology', name: 'Technology', description: 'Systems, hardware, protocols, and emerging tools' },
  { id: 'cat-ai', name: 'Artificial Intelligence', description: 'Machine learning, reasoning, and model architectures' },
  { id: 'cat-programming', name: 'Programming', description: 'Languages, algorithms, distributed systems, and debugging' },
  { id: 'cat-cybersecurity', name: 'Cybersecurity', description: 'Cryptography, network defense, and threat modeling' },
  { id: 'cat-business', name: 'Business', description: 'Strategy, operations, product craft, and economics' },
  { id: 'cat-finance', name: 'Finance', description: 'Markets, payments, risk, and personal capital' },
  { id: 'cat-science', name: 'Science', description: 'Physics, biology, chemistry, and natural phenomena' },
  { id: 'cat-mathematics', name: 'Mathematics', description: 'Proofs, probability, topology, and formal logic' },
  { id: 'cat-education', name: 'Education', description: 'Pedagogy, memory systems, and deliberate practice' },
  { id: 'cat-personal', name: 'Personal Development', description: 'Habits, decision-making, health, and philosophy' },
  { id: 'cat-general', name: 'General', description: 'Everyday curiosity and uncategorized questions' },
];

export const DEFAULT_PREFERENCES: GeneralPreferences = {
  appName: 'QuestBook',
  theme: 'light',
  language: 'English',
  dateFormat: 'MMM d, yyyy',
  defaultPriority: 'medium',
  defaultCategoryId: 'cat-general',
  autoSyncOnConnect: true,
  signalingUrl: '',
  localCompanionUrl: 'ws://localhost:8765/ws/sync',
  stunServers: ['stun:stun.l.google.com:19302'],
  turnServerUrl: '',
  turnUsername: '',
  appLockEnabled: false,
  localEncryptionEnabled: false,
  autoBackupEnabled: true,
  retentionDaily: 7,
  retentionWeekly: 4,
  retentionMonthly: 6,
  aiFeaturesEnabled: false,
  aiProviderEndpoint: '',
};

export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = bytesToHex(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function detectBrowserDeviceName(): string {
  if (typeof navigator === 'undefined') return 'QuestBook Workstation';
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android PWA Device';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS PWA Device';
  if (/Mac/i.test(ua)) return 'Mac Browser Workstation';
  if (/Windows/i.test(ua)) return 'Windows Browser Workstation';
  return 'Linux Browser Workstation';
}

function detectDeviceType(): DeviceRecord['deviceType'] {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

let initPromise: Promise<LocalDeviceSecret> | null = null;

export async function ensureDatabaseInitialized(): Promise<LocalDeviceSecret> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const existingSecret = await db.localSecrets.get('self');
    if (existingSecret) {
      // Ensure built-in categories/providers exist if partially cleared
      const catCount = await db.categories.count();
      if (catCount === 0) await seedCategoriesAndProviders();
      return existingSecret;
    }

    const keys = generateDeviceKeyMaterial();
    const deviceId = uuid();
    const deviceName = detectBrowserDeviceName();
    const now = Date.now();
    const secret: LocalDeviceSecret = {
      id: 'self',
      deviceId,
      deviceName,
      ed25519SecretKeyHex: keys.ed25519SecretKeyHex,
      ed25519PublicKeyHex: keys.ed25519PublicKeyHex,
      x25519SecretKeyHex: keys.x25519SecretKeyHex,
      x25519PublicKeyHex: keys.x25519PublicKeyHex,
      fingerprint: keys.fingerprint,
      libraryMasterKeyHex: generateRandomKeyHex(32),
      keyVersion: 1,
    };

    const selfDevice: DeviceRecord = {
      id: deviceId,
      name: deviceName,
      deviceType: detectDeviceType(),
      ed25519PublicKey: keys.ed25519PublicKeyHex,
      x25519PublicKey: keys.x25519PublicKeyHex,
      fingerprint: keys.fingerprint,
      trustStatus: 'self',
      pairedAt: now,
      lastConnectedAt: now,
      lastSyncedAt: null,
      questionsCreatedCount: 0,
      questionsReceivedCount: 0,
      keyVersion: 1,
    };

    await db.transaction(
      'rw',
      [
        db.localSecrets,
        db.devices,
        db.deviceHistory,
        db.categories,
        db.searchProviders,
        db.preferences,
        db.questions,
        db.tags,
        db.questionTags,
        db.researchSessions,
        db.researchNotes,
        db.researchResources,
        db.questionDeviceHistory,
        db.syncOperations,
      ],
      async () => {
        await db.localSecrets.put(secret);
        await db.devices.put(selfDevice);
        await db.deviceHistory.put({
          id: uuid(),
          deviceId,
          deviceName,
          action: 'initialized',
          details: `Local cryptographic identity generated (${keys.fingerprint.slice(0, 14)}...)`,
          timestamp: now,
        });
        await db.preferences.put({
          key: 'general',
          value: JSON.stringify(DEFAULT_PREFERENCES),
          updatedAt: now,
        });
        await seedCategoriesAndProviders();
        await seedStarterQuestions(deviceId, deviceName, keys.ed25519SecretKeyHex, now);
      },
    );

    return secret;
  })();

  try {
    return await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}

async function seedCategoriesAndProviders() {
  const now = Date.now();
  const cats: Category[] = DEFAULT_CATEGORIES.map((c) => ({
    ...c,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }));
  await db.categories.bulkPut(cats);
  await db.searchProviders.bulkPut(BUILT_IN_PROVIDERS);
}

async function seedStarterQuestions(
  deviceId: string,
  deviceName: string,
  secretKeyHex: string,
  now: number,
) {
  const day = 24 * 60 * 60 * 1000;
  const starterTags: Tag[] = [
    { id: 'tag-cryptography', name: 'cryptography', createdAt: now, updatedAt: now, deletedAt: null },
    { id: 'tag-payments', name: 'payments', createdAt: now, updatedAt: now, deletedAt: null },
    { id: 'tag-distributed', name: 'distributed-systems', createdAt: now, updatedAt: now, deletedAt: null },
    { id: 'tag-physics', name: 'physics', createdAt: now, updatedAt: now, deletedAt: null },
  ];
  await db.tags.bulkPut(starterTags);

  const samples: Array<{
    id: string;
    title: string;
    description: string;
    categoryId: string;
    priority: QuestionPriority;
    status: QuestionStatus;
    isPinned: boolean;
    isFavorite: boolean;
    createdAt: number;
    lastResearchedAt: number | null;
    conclusion: string;
    keyFindings: string[];
    tagIds: string[];
  }> = [
    {
      id: 'q-seed-1',
      title: 'How does 3D Secure 2.0 authenticate online card payments without breaking checkout flow?',
      description: 'Compare frictionless risk-based scoring against step-up challenge flows between issuer ACS and merchant 3DS server.',
      categoryId: 'cat-finance',
      priority: 'high',
      status: 'exploring',
      isPinned: true,
      isFavorite: true,
      createdAt: now - 3 * day,
      lastResearchedAt: now - 2 * 60 * 60 * 1000,
      conclusion: '',
      keyFindings: ['Device fingerprinting and browser behavioral signals reduce challenge rate'],
      tagIds: ['tag-payments', 'tag-cryptography'],
    },
    {
      id: 'q-seed-2',
      title: 'Why do version vectors handle clock skew better than last-write-wins timestamps in cloudless sync?',
      description: 'Investigate causal ordering vs physical wall-clock drift across offline phones and laptops.',
      categoryId: 'cat-programming',
      priority: 'high',
      status: 'unexplored',
      isPinned: false,
      isFavorite: true,
      createdAt: now - 9 * day,
      lastResearchedAt: null,
      conclusion: '',
      keyFindings: [],
      tagIds: ['tag-distributed'],
    },
    {
      id: 'q-seed-3',
      title: 'How do millisecond pulsars maintain rotational stability comparable to atomic clocks?',
      description: 'Look into angular momentum conservation, accretion spin-up, and magnetic dipole braking.',
      categoryId: 'cat-science',
      priority: 'medium',
      status: 'new',
      isPinned: false,
      isFavorite: false,
      createdAt: now - 6 * 60 * 60 * 1000,
      lastResearchedAt: null,
      conclusion: '',
      keyFindings: [],
      tagIds: ['tag-physics'],
    },
    {
      id: 'q-seed-4',
      title: 'What makes Argon2id resistant to both side-channel cache attacks and GPU cracking?',
      description: 'Hybrid data-independent first pass (Argon2i) followed by data-dependent passes (Argon2d).',
      categoryId: 'cat-cybersecurity',
      priority: 'medium',
      status: 'completed',
      isPinned: false,
      isFavorite: false,
      createdAt: now - 14 * day,
      lastResearchedAt: now - 5 * day,
      conclusion: 'Argon2id combines Argon2i resistance to timing side-channels with Argon2d memory-hard resistance to TMTO/ASIC attacks.',
      keyFindings: ['Recommended by OWASP for password hashing and KDFs'],
      tagIds: ['tag-cryptography'],
    },
  ];

  for (const s of samples) {
    const q: Question = {
      id: s.id,
      title: s.title,
      description: s.description,
      categoryId: s.categoryId,
      priority: s.priority,
      status: s.status,
      sourceType: 'seed',
      isPinned: s.isPinned,
      isFavorite: s.isFavorite,
      conclusion: s.conclusion,
      keyFindings: s.keyFindings,
      revision: 1,
      versionVector: { [deviceId]: 1 },
      createdAt: s.createdAt,
      updatedAt: s.createdAt,
      archivedAt: null,
      deletedAt: null,
      lastResearchedAt: s.lastResearchedAt,
      createdDeviceId: deviceId,
      createdDeviceName: deviceName,
      lastModifiedDeviceId: deviceId,
      lastSyncedFromDeviceId: null,
      lastSyncedFromDeviceName: null,
      lastSyncedAt: null,
    };
    await db.questions.put(q);

    for (const tid of s.tagIds) {
      await db.questionTags.put({
        id: `${q.id}:${tid}`,
        questionId: q.id,
        tagId: tid,
        createdAt: s.createdAt,
        deletedAt: null,
      });
    }

    const opBase = {
      operationId: uuid(),
      entityType: 'question' as const,
      entityId: q.id,
      deviceId,
      deviceName,
      entityRevision: 1,
      baseRevision: 0,
      versionVector: q.versionVector,
      operationType: 'create' as const,
      timestamp: s.createdAt,
      payload: q as unknown as Record<string, unknown>,
    };
    const payloadHash = computeOperationHash(opBase);
    await db.syncOperations.put({
      ...opBase,
      payloadHash,
      signature: signPayload(payloadHash, secretKeyHex),
    });

    await db.questionDeviceHistory.put({
      id: uuid(),
      questionId: q.id,
      deviceId,
      deviceName,
      action: 'created',
      timestamp: s.createdAt,
      operationId: opBase.operationId,
      summary: `Captured on ${deviceName}`,
    });
  }

  // Starter research session + note + resource for q-seed-1
  const sessId = 'sess-seed-1';
  await db.researchSessions.put({
    id: sessId,
    questionId: 'q-seed-1',
    title: 'EMVCo 3DS 2.2 Protocol Flow Investigation',
    goal: 'Map out AReq/ARes vs CReq/CRes message exchange',
    status: 'active',
    startedAt: now - 2 * 60 * 60 * 1000,
    endedAt: null,
    createdDeviceId: deviceId,
    updatedAt: now - 2 * 60 * 60 * 1000,
    deletedAt: null,
  });
  await db.researchNotes.put({
    id: 'note-seed-1',
    questionId: 'q-seed-1',
    sessionId: sessId,
    providerName: 'Perplexity',
    content: '3DS 2.0 passes 10x more contextual data points (device screen, timezone, shipping match) in the AReq payload so issuers can approve low-risk transactions silently.',
    isKeyFinding: true,
    createdAt: now - 90 * 60 * 1000,
    updatedAt: now - 90 * 60 * 1000,
    createdDeviceId: deviceId,
    createdDeviceName: deviceName,
    lastModifiedDeviceId: deviceId,
    versionVector: { [deviceId]: 1 },
    deletedAt: null,
  });
  await db.researchResources.put({
    id: 'res-seed-1',
    questionId: 'q-seed-1',
    sessionId: sessId,
    title: 'EMVCo 3-D Secure Protocol Specification Overview',
    url: 'https://www.emvco.com/emv-technologies/3-d-secure/',
    resourceType: 'reference',
    notes: 'Official specification page for 3DS v2.2 & v2.3',
    createdAt: now - 85 * 60 * 1000,
    createdDeviceId: deviceId,
    deletedAt: null,
  });

  await db.devices.update(deviceId, { questionsCreatedCount: samples.length });
}

async function recordSyncOp(
  secret: LocalDeviceSecret,
  entityType: SyncEntityType,
  entityId: string,
  operationType: SyncOperationType,
  entityRevision: number,
  baseRevision: number,
  versionVector: Record<string, number>,
  payload: Record<string, unknown>,
): Promise<SyncOperation> {
  const opBase = {
    operationId: uuid(),
    entityType,
    entityId,
    deviceId: secret.deviceId,
    deviceName: secret.deviceName,
    entityRevision,
    baseRevision,
    versionVector,
    operationType,
    timestamp: Date.now(),
    payload,
  };
  const payloadHash = computeOperationHash(opBase);
  const fullOp: SyncOperation = {
    ...opBase,
    payloadHash,
    signature: signPayload(payloadHash, secret.ed25519SecretKeyHex),
  };
  await db.syncOperations.put(fullOp);
  return fullOp;
}

async function recordQuestionHistory(
  questionId: string,
  secret: LocalDeviceSecret,
  action: QuestionHistoryAction,
  operationId: string,
  summary: string,
) {
  await db.questionDeviceHistory.put({
    id: uuid(),
    questionId,
    deviceId: secret.deviceId,
    deviceName: secret.deviceName,
    action,
    timestamp: Date.now(),
    operationId,
    summary,
  });
}

// Local transparent encryption helpers when user enables "Local Encryption" in Settings
function maybeEncryptQuestionForStorage(q: Question, secret: LocalDeviceSecret, enabled: boolean): Question {
  if (!enabled) return { ...q, encryptedPayload: undefined };
  const key = hexToBytes(secret.libraryMasterKeyHex);
  const sensitive = JSON.stringify({
    title: q.title,
    description: q.description,
    conclusion: q.conclusion,
  });
  const enc = encryptText(sensitive, key, q.id);
  return {
    ...q,
    encryptedPayload: JSON.stringify(enc),
  };
}

export function decryptQuestionIfNeeded(q: Question, secret: LocalDeviceSecret | null): Question {
  if (!q.encryptedPayload || !secret) return q;
  try {
    const parsed = JSON.parse(q.encryptedPayload) as { nonceHex: string; cipherHex: string };
    const plain = decryptText(parsed.cipherHex, parsed.nonceHex, hexToBytes(secret.libraryMasterKeyHex), q.id);
    const data = JSON.parse(plain) as { title: string; description: string; conclusion: string };
    return { ...q, ...data };
  } catch {
    return q;
  }
}

export const QuestBookRepo = {
  async getLocalSecret(): Promise<LocalDeviceSecret> {
    return ensureDatabaseInitialized();
  },

  async getPreferences(): Promise<GeneralPreferences> {
    await ensureDatabaseInitialized();
    const row = await db.preferences.get('general');
    if (!row) return DEFAULT_PREFERENCES;
    try {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(row.value) };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  },

  async updatePreferences(patch: Partial<GeneralPreferences>): Promise<GeneralPreferences> {
    const current = await this.getPreferences();
    const next = { ...current, ...patch };
    await db.preferences.put({
      key: 'general',
      value: JSON.stringify(next),
      updatedAt: Date.now(),
    });
    return next;
  },

  async createQuestion(input: {
    title: string;
    description?: string;
    categoryId?: string;
    priority?: QuestionPriority;
    status?: QuestionStatus;
    sourceType?: SourceType;
    sourceUrl?: string;
    tagNames?: string[];
    attachments?: Array<{ fileName: string; mimeType: string; size: number; dataUrl: string; caption?: string }>;
  }): Promise<Question> {
    const title = input.title.trim();
    if (!title) throw new Error('Question title is required.');

    const secret = await ensureDatabaseInitialized();
    const prefs = await this.getPreferences();
    const now = Date.now();
    const qId = uuid();

    const baseQuestion: Question = {
      id: qId,
      title,
      description: (input.description ?? '').trim(),
      categoryId: input.categoryId || prefs.defaultCategoryId || 'cat-general',
      priority: input.priority || prefs.defaultPriority || 'medium',
      status: input.status || 'new',
      sourceType: input.sourceType || 'text',
      sourceUrl: input.sourceUrl?.trim() || undefined,
      isPinned: false,
      isFavorite: false,
      conclusion: '',
      keyFindings: [],
      revision: 1,
      versionVector: { [secret.deviceId]: 1 },
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      deletedAt: null,
      lastResearchedAt: null,
      createdDeviceId: secret.deviceId,
      createdDeviceName: secret.deviceName,
      lastModifiedDeviceId: secret.deviceId,
      lastSyncedFromDeviceId: null,
      lastSyncedFromDeviceName: null,
      lastSyncedAt: null,
    };

    const storedQuestion = maybeEncryptQuestionForStorage(baseQuestion, secret, prefs.localEncryptionEnabled);

    await db.transaction(
      'rw',
      [
        db.questions,
        db.tags,
        db.questionTags,
        db.attachments,
        db.syncOperations,
        db.questionDeviceHistory,
        db.devices,
      ],
      async () => {
        await db.questions.put(storedQuestion);

        if (input.tagNames && input.tagNames.length > 0) {
          for (const rawName of input.tagNames) {
            const name = rawName.trim().toLowerCase();
            if (!name) continue;
            let tag = await db.tags.where('name').equals(name).first();
            if (!tag) {
              tag = { id: uuid(), name, createdAt: now, updatedAt: now, deletedAt: null };
              await db.tags.put(tag);
            } else if (tag.deletedAt !== null) {
              tag = { ...tag, deletedAt: null, updatedAt: now };
              await db.tags.put(tag);
            }
            await db.questionTags.put({
              id: `${qId}:${tag.id}`,
              questionId: qId,
              tagId: tag.id,
              createdAt: now,
              deletedAt: null,
            });
          }
        }

        if (input.attachments && input.attachments.length > 0) {
          for (const att of input.attachments) {
            const hash = sha256Hex(att.dataUrl);
            const attachment: Attachment = {
              id: uuid(),
              questionId: qId,
              fileName: att.fileName,
              mimeType: att.mimeType,
              size: att.size,
              sha256: hash,
              dataUrl: att.dataUrl,
              caption: att.caption ?? '',
              createdAt: now,
              createdDeviceId: secret.deviceId,
              deletedAt: null,
            };
            await db.attachments.put(attachment);
            await recordSyncOp(
              secret,
              'attachment',
              attachment.id,
              'create',
              1,
              0,
              { [secret.deviceId]: 1 },
              attachment as unknown as Record<string, unknown>,
            );
          }
        }

        const op = await recordSyncOp(
          secret,
          'question',
          qId,
          'create',
          1,
          0,
          baseQuestion.versionVector,
          baseQuestion as unknown as Record<string, unknown>,
        );
        await recordQuestionHistory(qId, secret, 'created', op.operationId, `Captured on ${secret.deviceName}`);

        const selfDev = await db.devices.get(secret.deviceId);
        if (selfDev) {
          await db.devices.update(secret.deviceId, {
            questionsCreatedCount: (selfDev.questionsCreatedCount ?? 0) + 1,
          });
        }
      },
    );

    return baseQuestion;
  },

  async updateQuestion(
    id: string,
    patch: Partial<
      Pick<
        Question,
        | 'title'
        | 'description'
        | 'categoryId'
        | 'priority'
        | 'status'
        | 'sourceUrl'
        | 'isPinned'
        | 'isFavorite'
        | 'conclusion'
        | 'keyFindings'
        | 'archivedAt'
        | 'lastResearchedAt'
      >
    >,
    historyAction: QuestionHistoryAction = 'edited',
    summary?: string,
  ): Promise<Question> {
    const secret = await ensureDatabaseInitialized();
    const prefs = await this.getPreferences();
    const existing = await db.questions.get(id);
    if (!existing) throw new Error('Question not found.');

    const nextVector = incrementVector(existing.versionVector, secret.deviceId);
    const updated: Question = {
      ...existing,
      ...patch,
      revision: existing.revision + 1,
      versionVector: nextVector,
      updatedAt: Date.now(),
      lastModifiedDeviceId: secret.deviceId,
    };

    const stored = maybeEncryptQuestionForStorage(updated, secret, prefs.localEncryptionEnabled);

    await db.transaction('rw', [db.questions, db.syncOperations, db.questionDeviceHistory], async () => {
      await db.questions.put(stored);
      const op = await recordSyncOp(
        secret,
        'question',
        id,
        'update',
        updated.revision,
        existing.revision,
        nextVector,
        updated as unknown as Record<string, unknown>,
      );
      await recordQuestionHistory(
        id,
        secret,
        historyAction,
        op.operationId,
        summary ?? `Updated on ${secret.deviceName}`,
      );
    });

    return updated;
  },

  async softDeleteQuestion(id: string): Promise<void> {
    const secret = await ensureDatabaseInitialized();
    const existing = await db.questions.get(id);
    if (!existing) return;
    const now = Date.now();
    const nextVector = incrementVector(existing.versionVector, secret.deviceId);
    const updated: Question = {
      ...existing,
      deletedAt: now,
      updatedAt: now,
      revision: existing.revision + 1,
      versionVector: nextVector,
      lastModifiedDeviceId: secret.deviceId,
    };
    await db.transaction('rw', [db.questions, db.syncOperations, db.questionDeviceHistory], async () => {
      await db.questions.put(updated);
      const op = await recordSyncOp(
        secret,
        'question',
        id,
        'delete',
        updated.revision,
        existing.revision,
        nextVector,
        updated as unknown as Record<string, unknown>,
      );
      await recordQuestionHistory(id, secret, 'deleted', op.operationId, `Moved to Trash on ${secret.deviceName}`);
    });
  },

  async restoreQuestion(id: string): Promise<void> {
    const secret = await ensureDatabaseInitialized();
    const existing = await db.questions.get(id);
    if (!existing) return;
    const now = Date.now();
    const nextVector = incrementVector(existing.versionVector, secret.deviceId);
    const updated: Question = {
      ...existing,
      deletedAt: null,
      archivedAt: null,
      updatedAt: now,
      revision: existing.revision + 1,
      versionVector: nextVector,
      lastModifiedDeviceId: secret.deviceId,
    };
    await db.transaction('rw', [db.questions, db.syncOperations, db.questionDeviceHistory], async () => {
      await db.questions.put(updated);
      const op = await recordSyncOp(
        secret,
        'question',
        id,
        'restore',
        updated.revision,
        existing.revision,
        nextVector,
        updated as unknown as Record<string, unknown>,
      );
      await recordQuestionHistory(id, secret, 'restored', op.operationId, `Restored from Trash on ${secret.deviceName}`);
    });
  },

  async permanentlyPurgeQuestion(id: string): Promise<void> {
    await db.transaction(
      'rw',
      [
        db.questions,
        db.questionTags,
        db.attachments,
        db.researchSessions,
        db.researchNotes,
        db.researchResources,
        db.relatedQuestions,
        db.reminders,
        db.researchActivities,
        db.questionDeviceHistory,
      ],
      async () => {
        await db.questions.delete(id);
        await db.questionTags.where('questionId').equals(id).delete();
        await db.attachments.where('questionId').equals(id).delete();
        await db.researchSessions.where('questionId').equals(id).delete();
        await db.researchNotes.where('questionId').equals(id).delete();
        await db.researchResources.where('questionId').equals(id).delete();
        await db.relatedQuestions.where('questionId').equals(id).delete();
        await db.reminders.where('questionId').equals(id).delete();
        await db.researchActivities.where('questionId').equals(id).delete();
        await db.questionDeviceHistory.where('questionId').equals(id).delete();
      },
    );
  },

  async setQuestionTags(questionId: string, tagNames: string[]): Promise<void> {
    const secret = await ensureDatabaseInitialized();
    const now = Date.now();
    const normalized = Array.from(new Set(tagNames.map((t) => t.trim().toLowerCase()).filter(Boolean)));

    await db.transaction('rw', [db.tags, db.questionTags], async () => {
      const currentLinks = await db.questionTags.where('questionId').equals(questionId).toArray();
      for (const link of currentLinks) {
        await db.questionTags.put({ ...link, deletedAt: now });
      }
      for (const name of normalized) {
        let tag = await db.tags.where('name').equals(name).first();
        if (!tag) {
          tag = { id: uuid(), name, createdAt: now, updatedAt: now, deletedAt: null };
          await db.tags.put(tag);
        } else if (tag.deletedAt !== null) {
          tag = { ...tag, deletedAt: null, updatedAt: now };
          await db.tags.put(tag);
        }
        await db.questionTags.put({
          id: `${questionId}:${tag.id}`,
          questionId,
          tagId: tag.id,
          createdAt: now,
          deletedAt: null,
        });
      }
    });

    await this.updateQuestion(questionId, {}, 'edited', `Updated tags on ${secret.deviceName}`);
  },

  async addCategory(name: string, description = ''): Promise<Category> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Category name is required.');
    const existing = await db.categories.filter((c) => c.deletedAt === null && c.name.toLowerCase() === trimmed.toLowerCase()).first();
    if (existing) throw new Error('A category with this name already exists.');
    const now = Date.now();
    const cat: Category = {
      id: uuid(),
      name: trimmed,
      description: description.trim(),
      isDefault: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await db.categories.put(cat);
    return cat;
  },

  async deleteCategory(id: string): Promise<void> {
    const cat = await db.categories.get(id);
    if (!cat || cat.id === 'cat-general') return;
    await db.transaction('rw', [db.categories, db.questions], async () => {
      await db.categories.put({ ...cat, deletedAt: Date.now() });
      await db.questions
        .where('categoryId')
        .equals(id)
        .modify({ categoryId: 'cat-general', updatedAt: Date.now() });
    });
  },

  async addAttachment(
    questionId: string,
    file: { fileName: string; mimeType: string; size: number; dataUrl: string; caption?: string },
  ): Promise<Attachment> {
    const secret = await ensureDatabaseInitialized();
    const att: Attachment = {
      id: uuid(),
      questionId,
      fileName: file.fileName,
      mimeType: file.mimeType,
      size: file.size,
      sha256: sha256Hex(file.dataUrl),
      dataUrl: file.dataUrl,
      caption: file.caption ?? '',
      createdAt: Date.now(),
      createdDeviceId: secret.deviceId,
      deletedAt: null,
    };
    await db.attachments.put(att);
    await recordSyncOp(
      secret,
      'attachment',
      att.id,
      'create',
      1,
      0,
      { [secret.deviceId]: 1 },
      att as unknown as Record<string, unknown>,
    );
    return att;
  },

  async createResearchSession(questionId: string, title: string, goal = ''): Promise<ResearchSession> {
    const secret = await ensureDatabaseInitialized();
    const now = Date.now();
    const session: ResearchSession = {
      id: uuid(),
      questionId,
      title: title.trim() || `Research Session`,
      goal: goal.trim(),
      status: 'active',
      startedAt: now,
      endedAt: null,
      createdDeviceId: secret.deviceId,
      updatedAt: now,
      deletedAt: null,
    };
    await db.researchSessions.put(session);
    await this.updateQuestion(questionId, { status: 'exploring', lastResearchedAt: now }, 'edited', 'Started research session');
    return session;
  },

  async updateResearchSessionStatus(sessionId: string, status: ResearchSession['status']): Promise<void> {
    const sess = await db.researchSessions.get(sessionId);
    if (!sess) return;
    await db.researchSessions.put({
      ...sess,
      status,
      endedAt: status === 'completed' ? Date.now() : null,
      updatedAt: Date.now(),
    });
  },

  async addResearchNote(input: {
    questionId: string;
    sessionId: string | null;
    providerName: string;
    content: string;
    isKeyFinding?: boolean;
  }): Promise<ResearchNote> {
    if (!input.content.trim()) throw new Error('Note content cannot be empty.');
    const secret = await ensureDatabaseInitialized();
    const now = Date.now();
    const note: ResearchNote = {
      id: uuid(),
      questionId: input.questionId,
      sessionId: input.sessionId,
      providerName: input.providerName.trim() || 'Manual Note',
      content: input.content.trim(),
      isKeyFinding: !!input.isKeyFinding,
      createdAt: now,
      updatedAt: now,
      createdDeviceId: secret.deviceId,
      createdDeviceName: secret.deviceName,
      lastModifiedDeviceId: secret.deviceId,
      versionVector: { [secret.deviceId]: 1 },
      deletedAt: null,
    };
    await db.researchNotes.put(note);
    await recordSyncOp(
      secret,
      'research_note',
      note.id,
      'create',
      1,
      0,
      note.versionVector,
      note as unknown as Record<string, unknown>,
    );
    await this.updateQuestion(
      input.questionId,
      { lastResearchedAt: now },
      'edited',
      `Added research note (${note.providerName})`,
    );
    return note;
  },

  async addResearchResource(input: {
    questionId: string;
    sessionId: string | null;
    title: string;
    url: string;
    resourceType: ResearchResource['resourceType'];
    notes?: string;
  }): Promise<ResearchResource> {
    const check = validateProviderUrlTemplate(input.url);
    if (!check.valid) throw new Error(check.error);
    const secret = await ensureDatabaseInitialized();
    const res: ResearchResource = {
      id: uuid(),
      questionId: input.questionId,
      sessionId: input.sessionId,
      title: input.title.trim() || input.url.trim(),
      url: input.url.trim(),
      resourceType: input.resourceType,
      notes: (input.notes ?? '').trim(),
      createdAt: Date.now(),
      createdDeviceId: secret.deviceId,
      deletedAt: null,
    };
    await db.researchResources.put(res);
    return res;
  },

  async linkRelatedQuestion(
    questionId: string,
    relatedQuestionId: string,
    relationship: RelatedQuestion['relationship'],
  ): Promise<void> {
    if (questionId === relatedQuestionId) throw new Error('A question cannot link to itself.');
    const secret = await ensureDatabaseInitialized();
    await db.relatedQuestions.put({
      id: `${questionId}:${relatedQuestionId}`,
      questionId,
      relatedQuestionId,
      relationship,
      createdAt: Date.now(),
      createdDeviceId: secret.deviceId,
      deletedAt: null,
    });
  },

  async recordResearchActivity(input: {
    questionId: string;
    sessionId: string | null;
    providerId: string;
    providerName: string;
    searchQuery: string;
    launchedUrl: string;
  }): Promise<ResearchActivity> {
    const secret = await ensureDatabaseInitialized();
    const now = Date.now();
    const activity: ResearchActivity = {
      id: uuid(),
      questionId: input.questionId,
      sessionId: input.sessionId,
      providerId: input.providerId,
      providerName: input.providerName,
      searchQuery: input.searchQuery,
      launchedUrl: input.launchedUrl,
      launchedAt: now,
      launchingDeviceId: secret.deviceId,
      status: 'opened',
    };
    await db.researchActivities.put(activity);
    const q = await db.questions.get(input.questionId);
    if (q && (q.status === 'new' || q.status === 'unexplored')) {
      await this.updateQuestion(input.questionId, { status: 'exploring', lastResearchedAt: now }, 'edited', `Launched ${input.providerName}`);
    } else if (q) {
      await db.questions.update(input.questionId, { lastResearchedAt: now });
    }
    return activity;
  },

  async updateResearchActivityStatus(id: string, status: ResearchActivityStatus): Promise<void> {
    await db.researchActivities.update(id, { status });
  },

  async saveSearchProvider(provider: SearchProvider): Promise<void> {
    const check = validateProviderUrlTemplate(provider.urlTemplate);
    if (!check.valid) throw new Error(check.error);
    await db.transaction('rw', db.searchProviders, async () => {
      if (provider.isDefault) {
        await db.searchProviders.toCollection().modify({ isDefault: false });
      }
      await db.searchProviders.put({ ...provider, updatedAt: Date.now() });
    });
  },

  async setDefaultProvider(id: string): Promise<void> {
    await db.transaction('rw', db.searchProviders, async () => {
      await db.searchProviders.toCollection().modify({ isDefault: false });
      await db.searchProviders.update(id, { isDefault: true, enabled: true, updatedAt: Date.now() });
    });
  },

  async deleteCustomProvider(id: string): Promise<void> {
    const p = await db.searchProviders.get(id);
    if (!p || p.isBuiltIn) return;
    await db.searchProviders.delete(id);
  },

  async upsertReminder(questionId: string, dueAt: number, note: string): Promise<Reminder> {
    const now = Date.now();
    const r: Reminder = {
      id: uuid(),
      questionId,
      dueAt,
      note: note.trim(),
      dismissed: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await db.reminders.put(r);
    return r;
  },

  async dismissReminder(id: string): Promise<void> {
    await db.reminders.update(id, { dismissed: true, updatedAt: Date.now() });
  },

  // Device Management & Key Rotation
  async pairTrustedDevice(peer: {
    id: string;
    name: string;
    deviceType: DeviceRecord['deviceType'];
    ed25519PublicKey: string;
    x25519PublicKey: string;
    fingerprint: string;
  }): Promise<DeviceRecord> {
    const secret = await ensureDatabaseInitialized();
    const now = Date.now();
    const wrapped = wrapLibraryKeyForPeer(
      secret.libraryMasterKeyHex,
      secret.x25519SecretKeyHex,
      peer.x25519PublicKey,
    );
    const record: DeviceRecord = {
      id: peer.id,
      name: peer.name,
      deviceType: peer.deviceType,
      ed25519PublicKey: peer.ed25519PublicKey,
      x25519PublicKey: peer.x25519PublicKey,
      fingerprint: peer.fingerprint,
      trustStatus: 'trusted',
      pairedAt: now,
      lastConnectedAt: now,
      lastSyncedAt: null,
      questionsCreatedCount: 0,
      questionsReceivedCount: 0,
      keyVersion: secret.keyVersion,
      wrappedLibraryKey: JSON.stringify(wrapped),
    };
    await db.devices.put(record);
    await db.deviceHistory.put({
      id: uuid(),
      deviceId: peer.id,
      deviceName: peer.name,
      action: 'paired',
      details: `Paired via cryptographic identity exchange (${peer.fingerprint})`,
      timestamp: now,
    });
    return record;
  },

  async renameDevice(deviceId: string, newName: string): Promise<void> {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('Device name cannot be empty.');
    const secret = await ensureDatabaseInitialized();
    const dev = await db.devices.get(deviceId);
    if (!dev) return;
    await db.devices.update(deviceId, { name: trimmed });
    if (deviceId === secret.deviceId) {
      await db.localSecrets.update('self', { deviceName: trimmed });
      secret.deviceName = trimmed;
    }
    await db.deviceHistory.put({
      id: uuid(),
      deviceId,
      deviceName: trimmed,
      action: 'renamed',
      details: `Renamed from "${dev.name}" to "${trimmed}"`,
      timestamp: Date.now(),
    });
  },

  async revokeDeviceAndRotateKeys(deviceId: string): Promise<{ newKeyVersion: number; rewrappedCount: number }> {
    const secret = await ensureDatabaseInitialized();
    const target = await db.devices.get(deviceId);
    if (!target || target.trustStatus === 'self') {
      throw new Error('Cannot revoke the current device.');
    }
    const now = Date.now();
    const newMasterKey = generateRandomKeyHex(32);
    const newKeyVersion = secret.keyVersion + 1;

    await db.devices.update(deviceId, { trustStatus: 'revoked' });
    await db.localSecrets.update('self', {
      libraryMasterKeyHex: newMasterKey,
      keyVersion: newKeyVersion,
    });
    secret.libraryMasterKeyHex = newMasterKey;
    secret.keyVersion = newKeyVersion;

    const remainingTrusted = await db.devices.where('trustStatus').equals('trusted').toArray();
    for (const peer of remainingTrusted) {
      const wrapped = wrapLibraryKeyForPeer(newMasterKey, secret.x25519SecretKeyHex, peer.x25519PublicKey);
      await db.devices.update(peer.id, {
        keyVersion: newKeyVersion,
        wrappedLibraryKey: JSON.stringify(wrapped),
      });
    }

    await db.deviceHistory.put({
      id: uuid(),
      deviceId,
      deviceName: target.name,
      action: 'revoked',
      details: `Device revoked and library encryption key rotated to v${newKeyVersion} for ${remainingTrusted.length} remaining trusted peer(s).`,
      timestamp: now,
    });

    return { newKeyVersion, rewrappedCount: remainingTrusted.length };
  },

  async removeDevice(deviceId: string): Promise<void> {
    const dev = await db.devices.get(deviceId);
    if (!dev || dev.trustStatus === 'self') return;
    await db.devices.delete(deviceId);
    await db.syncCheckpoints.delete(deviceId);
  },

  // Apply incoming sync batch transactionally
  async applyIncomingOperations(
    senderDeviceId: string,
    ops: SyncOperation[],
  ): Promise<{ appliedCount: number; conflictCount: number; rejected: boolean; reason?: string }> {
    const secret = await ensureDatabaseInitialized();
    const sender = await db.devices.get(senderDeviceId);
    if (!sender) {
      return { appliedCount: 0, conflictCount: 0, rejected: true, reason: 'Untrusted unknown peer device.' };
    }
    if (sender.trustStatus === 'revoked') {
      await db.deviceHistory.put({
        id: uuid(),
        deviceId: sender.id,
        deviceName: sender.name,
        action: 'rejected',
        details: 'Blocked inbound sync batch from revoked device.',
        timestamp: Date.now(),
      });
      return { appliedCount: 0, conflictCount: 0, rejected: true, reason: `Peer "${sender.name}" is revoked.` };
    }

    let appliedCount = 0;
    let conflictCount = 0;
    const ackedIds: string[] = [];

    await db.transaction(
      'rw',
      [
        db.questions,
        db.researchNotes,
        db.attachments,
        db.conflicts,
        db.questionDeviceHistory,
        db.syncOperations,
        db.devices,
        db.syncCheckpoints,
      ],
      async () => {
        for (const op of ops) {
          const alreadyExists = await db.syncOperations.get(op.operationId);
          if (alreadyExists) {
            ackedIds.push(op.operationId);
            continue;
          }

          if (op.entityType === 'question') {
            const localQ = await db.questions.get(op.entityId);
            const result = mergeQuestionOperation(localQ, op, sender, secret.deviceId);
            await db.questions.put(result.merged);
            await db.questionDeviceHistory.put(result.historyEvent);
            if (result.conflicts.length > 0) {
              await db.conflicts.bulkPut(result.conflicts);
              conflictCount += result.conflicts.length;
            }
            if (!localQ) {
              await db.devices.update(sender.id, {
                questionsReceivedCount: (sender.questionsReceivedCount ?? 0) + 1,
              });
            }
            appliedCount++;
          } else if (op.entityType === 'research_note') {
            const remoteNote = op.payload as unknown as ResearchNote;
            const localNote = await db.researchNotes.get(op.entityId);
            const merged = mergeResearchNote(localNote, remoteNote);
            await db.researchNotes.put(merged);
            appliedCount++;
          } else if (op.entityType === 'attachment') {
            const remoteAtt = op.payload as unknown as Attachment;
            const existingByHash = await db.attachments.where('sha256').equals(remoteAtt.sha256).first();
            if (!existingByHash) {
              await db.attachments.put(remoteAtt);
              appliedCount++;
            }
          }

          await db.syncOperations.put(op);
          ackedIds.push(op.operationId);
        }

        const now = Date.now();
        await db.devices.update(sender.id, { lastConnectedAt: now, lastSyncedAt: now });
        await db.syncCheckpoints.put({
          peerDeviceId: sender.id,
          lastAckedTimestamp: now,
          lastAckedOperationIds: ackedIds.slice(-200),
          lastSyncDirection: 'bidirectional',
          lastSyncStatus: 'success',
          lastSyncSummary: `Applied ${appliedCount} ops (${conflictCount} conflicts) with ${sender.name}`,
          updatedAt: now,
        });
      },
    );

    return { appliedCount, conflictCount, rejected: false };
  },

  async resolveConflict(
    conflictId: string,
    choice: 'local' | 'remote' | 'merged',
    customValue?: string,
  ): Promise<void> {
    const secret = await ensureDatabaseInitialized();
    const conflict = await db.conflicts.get(conflictId);
    if (!conflict || conflict.resolved) return;

    const chosenValue =
      choice === 'local'
        ? conflict.localValue
        : choice === 'remote'
          ? conflict.remoteValue
          : (customValue ?? `${conflict.localValue}\n\n${conflict.remoteValue}`);

    const question = await db.questions.get(conflict.entityId);
    if (question) {
      await this.updateQuestion(
        question.id,
        { [conflict.field]: chosenValue } as Partial<Question>,
        'conflict_resolved',
        `Resolved ${conflict.field} conflict (${choice}) on ${secret.deviceName}`,
      );
    }

    await db.conflicts.update(conflictId, {
      resolved: true,
      resolutionChoice: choice,
      resolvedAt: Date.now(),
    });
  },

  // Encrypted .qbk Backup & Restore
  async buildArchivePayload(): Promise<QuestBookArchivePayload> {
    const secret = await ensureDatabaseInitialized();
    const [
      questions,
      categories,
      tags,
      questionTags,
      attachments,
      researchSessions,
      researchNotes,
      researchResources,
      relatedQuestions,
      reminders,
      searchProviders,
      researchActivities,
      devices,
      questionDeviceHistory,
    ] = await Promise.all([
      db.questions.toArray(),
      db.categories.toArray(),
      db.tags.toArray(),
      db.questionTags.toArray(),
      db.attachments.toArray(),
      db.researchSessions.toArray(),
      db.researchNotes.toArray(),
      db.researchResources.toArray(),
      db.relatedQuestions.toArray(),
      db.reminders.toArray(),
      db.searchProviders.toArray(),
      db.researchActivities.toArray(),
      db.devices.toArray(),
      db.questionDeviceHistory.toArray(),
    ]);

    return {
      schemaVersion: 2,
      exportedAt: Date.now(),
      exportedByDeviceId: secret.deviceId,
      exportedByDeviceName: secret.deviceName,
      questions: questions.map((q) => decryptQuestionIfNeeded(q, secret)),
      categories,
      tags,
      questionTags,
      attachments,
      researchSessions,
      researchNotes,
      researchResources,
      relatedQuestions,
      reminders,
      searchProviders,
      researchActivities,
      devices,
      questionDeviceHistory,
    };
  },

  async createManualQbkBackup(password: string): Promise<{ fileName: string; archiveString: string; record: BackupRecord }> {
    const payload = await this.buildArchivePayload();
    const { archiveString, checksumSha256, sizeBytes } = createEncryptedBackup(payload, password);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `questbook-backup-${ts}.qbk`;
    const record: BackupRecord = {
      id: uuid(),
      kind: 'manual_qbk',
      fileName,
      targetDescription: 'User-selected external storage (.qbk encrypted archive)',
      checksumSha256,
      sizeBytes,
      questionCount: payload.questions.length,
      attachmentCount: payload.attachments.length,
      status: 'verified',
      createdAt: Date.now(),
    };
    await db.backups.put(record);
    return { fileName, archiveString, record };
  },

  async createAutoPeerSnapshot(targetDeviceName: string, passwordOrKey: string): Promise<BackupRecord> {
    const payload = await this.buildArchivePayload();
    const { archiveString, checksumSha256, sizeBytes } = createEncryptedBackup(payload, passwordOrKey);
    const prefs = await this.getPreferences();
    const record: BackupRecord = {
      id: uuid(),
      kind: 'auto_peer_snapshot',
      fileName: `peer-snapshot-${Date.now()}.qbk`,
      targetDescription: targetDeviceName,
      checksumSha256,
      sizeBytes,
      questionCount: payload.questions.length,
      attachmentCount: payload.attachments.length,
      status: 'verified',
      createdAt: Date.now(),
      snapshotPayload: archiveString,
    };
    await db.backups.put(record);

    const allBackups = await db.backups.toArray();
    const { pruneIds } = evaluateBackupRetention(allBackups, {
      dailyCount: prefs.retentionDaily,
      weeklyCount: prefs.retentionWeekly,
      monthlyCount: prefs.retentionMonthly,
    });
    if (pruneIds.length > 0) {
      await db.backups.bulkDelete(pruneIds);
    }
    return record;
  },

  async restoreFromQbkBackup(archiveString: string, password: string): Promise<{ questionsRestored: number; attachmentsRestored: number }> {
    const payload = decryptAndVerifyBackup(archiveString, password);

    await db.transaction(
      'rw',
      [
        db.questions,
        db.categories,
        db.tags,
        db.questionTags,
        db.attachments,
        db.researchSessions,
        db.researchNotes,
        db.researchResources,
        db.relatedQuestions,
        db.reminders,
        db.searchProviders,
        db.researchActivities,
        db.questionDeviceHistory,
      ],
      async () => {
        if (payload.categories.length) await db.categories.bulkPut(payload.categories);
        if (payload.tags.length) await db.tags.bulkPut(payload.tags);
        if (payload.questionTags.length) await db.questionTags.bulkPut(payload.questionTags);
        if (payload.questions.length) await db.questions.bulkPut(payload.questions);
        if (payload.attachments.length) await db.attachments.bulkPut(payload.attachments);
        if (payload.researchSessions.length) await db.researchSessions.bulkPut(payload.researchSessions);
        if (payload.researchNotes.length) await db.researchNotes.bulkPut(payload.researchNotes);
        if (payload.researchResources.length) await db.researchResources.bulkPut(payload.researchResources);
        if (payload.relatedQuestions.length) await db.relatedQuestions.bulkPut(payload.relatedQuestions);
        if (payload.reminders.length) await db.reminders.bulkPut(payload.reminders);
        if (payload.searchProviders.length) await db.searchProviders.bulkPut(payload.searchProviders);
        if (payload.researchActivities.length) await db.researchActivities.bulkPut(payload.researchActivities);
        if (payload.questionDeviceHistory.length) await db.questionDeviceHistory.bulkPut(payload.questionDeviceHistory);
      },
    );

    return {
      questionsRestored: payload.questions.length,
      attachmentsRestored: payload.attachments.length,
    };
  },

  // App Lock & Local Encryption Security
  async setAppLockPasscode(passcode: string): Promise<void> {
    if (passcode.length < 4) throw new Error('App Lock PIN/passcode must be at least 4 characters.');
    const salt = randomBytes(16);
    const hash = derivePasswordKey(passcode, salt);
    await db.localSecrets.update('self', {
      appLockSaltHex: bytesToHex(salt),
      appLockHashHex: bytesToHex(hash),
    });
    await this.updatePreferences({ appLockEnabled: true });
  },

  async verifyAppLockPasscode(passcode: string): Promise<boolean> {
    const secret = await db.localSecrets.get('self');
    if (!secret?.appLockSaltHex || !secret.appLockHashHex) return true;
    const derived = derivePasswordKey(passcode, hexToBytes(secret.appLockSaltHex));
    return bytesToHex(derived) === secret.appLockHashHex;
  },

  async disableAppLock(): Promise<void> {
    await db.localSecrets.update('self', { appLockSaltHex: undefined, appLockHashHex: undefined });
    await this.updatePreferences({ appLockEnabled: false });
  },

  async wipeAllLocalData(): Promise<void> {
    await db.delete();
    initPromise = null;
    await db.open();
    await ensureDatabaseInitialized();
  },
};
