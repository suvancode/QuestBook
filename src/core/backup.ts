import {
  Attachment,
  BackupRecord,
  Category,
  DeviceRecord,
  Question,
  QuestionDeviceHistoryEvent,
  QuestionTag,
  RelatedQuestion,
  Reminder,
  ResearchActivity,
  ResearchNote,
  ResearchResource,
  ResearchSession,
  SearchProvider,
  Tag,
} from '../types/questbook';
import { bytesToHex, decryptText, derivePasswordKey, encryptText, hexToBytes, randomBytes, sha256Hex } from './crypto';

export interface QuestBookArchivePayload {
  schemaVersion: number;
  exportedAt: number;
  exportedByDeviceId: string;
  exportedByDeviceName: string;
  questions: Question[];
  categories: Category[];
  tags: Tag[];
  questionTags: QuestionTag[];
  attachments: Attachment[];
  researchSessions: ResearchSession[];
  researchNotes: ResearchNote[];
  researchResources: ResearchResource[];
  relatedQuestions: RelatedQuestion[];
  reminders: Reminder[];
  searchProviders: SearchProvider[];
  researchActivities: ResearchActivity[];
  devices: DeviceRecord[];
  questionDeviceHistory: QuestionDeviceHistoryEvent[];
}

export interface EncryptedQbkEnvelope {
  magic: 'QBK1';
  kdf: 'argon2id';
  kdfParams: { t: number; m: number; p: number };
  cipher: 'xchacha20-poly1305';
  saltHex: string;
  nonceHex: string;
  plaintextSha256: string;
  cipherHex: string;
  createdAt: number;
}

export function createEncryptedBackup(
  payload: QuestBookArchivePayload,
  password: string,
): { archiveString: string; checksumSha256: string; sizeBytes: number } {
  if (!password || password.length < 8) {
    throw new Error('Recovery password must be at least 8 characters long.');
  }
  const plaintext = JSON.stringify(payload);
  const plaintextSha256 = sha256Hex(plaintext);
  const salt = randomBytes(16);
  const key = derivePasswordKey(password, salt);
  const { nonceHex, cipherHex } = encryptText(plaintext, key, 'QBK1-ARCHIVE');

  const envelope: EncryptedQbkEnvelope = {
    magic: 'QBK1',
    kdf: 'argon2id',
    kdfParams: { t: 2, m: 16384, p: 1 },
    cipher: 'xchacha20-poly1305',
    saltHex: bytesToHex(salt),
    nonceHex,
    plaintextSha256,
    cipherHex,
    createdAt: Date.now(),
  };

  const archiveString = JSON.stringify(envelope, null, 2);
  return {
    archiveString,
    checksumSha256: plaintextSha256,
    sizeBytes: new TextEncoder().encode(archiveString).length,
  };
}

export function decryptAndVerifyBackup(archiveString: string, password: string): QuestBookArchivePayload {
  let envelope: EncryptedQbkEnvelope;
  try {
    envelope = JSON.parse(archiveString) as EncryptedQbkEnvelope;
  } catch {
    throw new Error('Corrupted .qbk archive: invalid JSON structure.');
  }

  if (envelope.magic !== 'QBK1' || envelope.cipher !== 'xchacha20-poly1305' || envelope.kdf !== 'argon2id') {
    throw new Error('Unsupported or corrupted .qbk archive header.');
  }
  if (!password) {
    throw new Error('Recovery password is required.');
  }

  const salt = hexToBytes(envelope.saltHex);
  const key = derivePasswordKey(password, salt);

  let plaintext: string;
  try {
    plaintext = decryptText(envelope.cipherHex, envelope.nonceHex, key, 'QBK1-ARCHIVE');
  } catch {
    throw new Error('Decryption failed: incorrect recovery password or tampered .qbk archive.');
  }

  const computedHash = sha256Hex(plaintext);
  if (computedHash !== envelope.plaintextSha256) {
    throw new Error('Archive integrity verification failed: SHA-256 checksum mismatch.');
  }

  const payload = JSON.parse(plaintext) as QuestBookArchivePayload;
  if (!Array.isArray(payload.questions) || !Array.isArray(payload.categories)) {
    throw new Error('Archive payload is missing required QuestBook collections.');
  }
  return payload;
}

export interface RetentionPolicy {
  dailyCount: number;
  weeklyCount: number;
  monthlyCount: number;
}

export function evaluateBackupRetention(
  backups: BackupRecord[],
  policy: RetentionPolicy,
  now = Date.now(),
): { keepIds: Set<string>; pruneIds: string[] } {
  const autoBackups = [...backups]
    .filter((b) => b.kind === 'auto_peer_snapshot')
    .sort((a, b) => b.createdAt - a.createdAt);

  const keepIds = new Set<string>();
  if (autoBackups.length === 0) {
    return { keepIds, pruneIds: [] };
  }

  // Always keep latest
  keepIds.add(autoBackups[0].id);

  const dailyBuckets = new Set<string>();
  const weeklyBuckets = new Set<string>();
  const monthlyBuckets = new Set<string>();

  for (const b of autoBackups) {
    const d = new Date(b.createdAt);
    const dayKey = d.toISOString().slice(0, 10);
    const weekNum = Math.floor((now - b.createdAt) / (7 * 24 * 60 * 60 * 1000));
    const weekKey = `w-${weekNum}`;
    const monthKey = d.toISOString().slice(0, 7);

    if (dailyBuckets.size < policy.dailyCount && !dailyBuckets.has(dayKey)) {
      dailyBuckets.add(dayKey);
      keepIds.add(b.id);
    } else if (weeklyBuckets.size < policy.weeklyCount && !weeklyBuckets.has(weekKey)) {
      weeklyBuckets.add(weekKey);
      keepIds.add(b.id);
    } else if (monthlyBuckets.size < policy.monthlyCount && !monthlyBuckets.has(monthKey)) {
      monthlyBuckets.add(monthKey);
      keepIds.add(b.id);
    }
  }

  const pruneIds = autoBackups.filter((b) => !keepIds.has(b.id)).map((b) => b.id);
  return { keepIds, pruneIds };
}
