import Dexie, { Table } from 'dexie';
import {
  AppPreference,
  Attachment,
  BackupRecord,
  Category,
  ConflictRecord,
  DeviceHistoryEvent,
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
  SyncCheckpoint,
  SyncOperation,
  Tag,
} from '../types/questbook';

export interface LocalDeviceSecret {
  id: 'self';
  deviceId: string;
  deviceName: string;
  ed25519SecretKeyHex: string;
  ed25519PublicKeyHex: string;
  x25519SecretKeyHex: string;
  x25519PublicKeyHex: string;
  fingerprint: string;
  libraryMasterKeyHex: string;
  keyVersion: number;
  appLockSaltHex?: string;
  appLockHashHex?: string;
}

export class QuestBookDatabase extends Dexie {
  questions!: Table<Question, string>;
  categories!: Table<Category, string>;
  tags!: Table<Tag, string>;
  questionTags!: Table<QuestionTag, string>;
  attachments!: Table<Attachment, string>;
  researchSessions!: Table<ResearchSession, string>;
  researchNotes!: Table<ResearchNote, string>;
  researchResources!: Table<ResearchResource, string>;
  relatedQuestions!: Table<RelatedQuestion, string>;
  reminders!: Table<Reminder, string>;
  searchProviders!: Table<SearchProvider, string>;
  researchActivities!: Table<ResearchActivity, string>;
  devices!: Table<DeviceRecord, string>;
  deviceHistory!: Table<DeviceHistoryEvent, string>;
  questionDeviceHistory!: Table<QuestionDeviceHistoryEvent, string>;
  syncOperations!: Table<SyncOperation, string>;
  syncCheckpoints!: Table<SyncCheckpoint, string>;
  conflicts!: Table<ConflictRecord, string>;
  backups!: Table<BackupRecord, string>;
  preferences!: Table<AppPreference, string>;
  localSecrets!: Table<LocalDeviceSecret, string>;

  constructor(dbName = 'QuestBookLocalDB') {
    super(dbName);

    // Schema v1: Initial 20-entity QuestBook local schema
    this.version(1).stores({
      questions: 'id, categoryId, status, priority, createdAt, updatedAt, archivedAt, deletedAt, isPinned, isFavorite, createdDeviceId',
      categories: 'id, name, isDefault, deletedAt',
      tags: 'id, name, deletedAt',
      questionTags: 'id, questionId, tagId, deletedAt',
      attachments: 'id, questionId, sha256, deletedAt',
      researchSessions: 'id, questionId, status, startedAt, deletedAt',
      researchNotes: 'id, questionId, sessionId, createdAt, deletedAt',
      researchResources: 'id, questionId, sessionId, resourceType, deletedAt',
      relatedQuestions: 'id, questionId, relatedQuestionId, deletedAt',
      reminders: 'id, questionId, dueAt, dismissed, deletedAt',
      searchProviders: 'id, displayOrder, enabled, isDefault',
      researchActivities: 'id, questionId, sessionId, providerId, launchedAt, status',
      devices: 'id, trustStatus, pairedAt, lastSyncedAt',
      deviceHistory: 'id, deviceId, action, timestamp',
      questionDeviceHistory: 'id, questionId, deviceId, action, timestamp, operationId',
      syncOperations: 'operationId, entityType, entityId, deviceId, timestamp',
      syncCheckpoints: 'peerDeviceId, updatedAt',
      conflicts: 'id, entityId, resolved, createdAt',
      backups: 'id, kind, createdAt',
      preferences: 'key',
      localSecrets: 'id',
    });

    // Schema v2: Adds lastResearchedAt index on questions & keyVersion tracking on devices
    this.version(2)
      .stores({
        questions:
          'id, categoryId, status, priority, createdAt, updatedAt, lastResearchedAt, archivedAt, deletedAt, isPinned, isFavorite, createdDeviceId',
        devices: 'id, trustStatus, pairedAt, lastSyncedAt, keyVersion',
      })
      .upgrade(async (tx) => {
        await tx
          .table('devices')
          .toCollection()
          .modify((device: DeviceRecord) => {
            if (!device.keyVersion) device.keyVersion = 1;
          });
      });
  }
}

export const db = new QuestBookDatabase();
