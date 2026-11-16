export type QuestionStatus = 'new' | 'unexplored' | 'exploring' | 'completed';
export type QuestionPriority = 'high' | 'medium' | 'low';
export type SourceType = 'text' | 'voice' | 'image' | 'share' | 'seed' | 'sync';
export type ProviderType = 'search_engine' | 'ai_assistant' | 'encyclopedia' | 'academic' | 'custom';
export type ResearchActivityStatus = 'opened' | 'in_progress' | 'completed';
export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'companion';
export type DeviceTrustStatus = 'self' | 'trusted' | 'pending' | 'revoked';

export type VersionVector = Record<string, number>;

export interface Question {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  priority: QuestionPriority;
  status: QuestionStatus;
  sourceType: SourceType;
  sourceUrl?: string;
  isPinned: boolean;
  isFavorite: boolean;
  conclusion: string;
  keyFindings: string[];
  revision: number;
  versionVector: VersionVector;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
  deletedAt: number | null;
  lastResearchedAt: number | null;
  createdDeviceId: string;
  createdDeviceName: string;
  lastModifiedDeviceId: string;
  lastSyncedFromDeviceId: string | null;
  lastSyncedFromDeviceName: string | null;
  lastSyncedAt: number | null;
  // Optional encrypted envelope marker when local field-level encryption is active
  encryptedPayload?: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface Tag {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface QuestionTag {
  id: string; // `${questionId}:${tagId}`
  questionId: string;
  tagId: string;
  createdAt: number;
  deletedAt: number | null;
}

export interface Attachment {
  id: string;
  questionId: string;
  fileName: string;
  mimeType: string;
  size: number;
  sha256: string;
  dataUrl: string; // Local Data URL or encrypted blob reference
  caption: string;
  createdAt: number;
  createdDeviceId: string;
  deletedAt: number | null;
}

export interface ResearchSession {
  id: string;
  questionId: string;
  title: string;
  goal: string;
  status: 'active' | 'paused' | 'completed';
  startedAt: number;
  endedAt: number | null;
  createdDeviceId: string;
  updatedAt: number;
  deletedAt: number | null;
}

export interface ResearchNote {
  id: string;
  questionId: string;
  sessionId: string | null;
  providerName: string;
  content: string;
  isKeyFinding: boolean;
  createdAt: number;
  updatedAt: number;
  createdDeviceId: string;
  createdDeviceName: string;
  lastModifiedDeviceId: string;
  versionVector: VersionVector;
  deletedAt: number | null;
}

export interface ResearchResource {
  id: string;
  questionId: string;
  sessionId: string | null;
  title: string;
  url: string;
  resourceType: 'article' | 'paper' | 'video' | 'ai_thread' | 'reference';
  notes: string;
  createdAt: number;
  createdDeviceId: string;
  deletedAt: number | null;
}

export interface RelatedQuestion {
  id: string;
  questionId: string;
  relatedQuestionId: string;
  relationship: 'prerequisite' | 'follow_up' | 'contradicts' | 'related';
  createdAt: number;
  createdDeviceId: string;
  deletedAt: number | null;
}

export interface Reminder {
  id: string;
  questionId: string;
  dueAt: number;
  note: string;
  dismissed: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface SearchProvider {
  id: string;
  name: string;
  type: ProviderType;
  urlTemplate: string;
  homepageUrl: string;
  iconKey: string;
  enabled: boolean;
  isDefault: boolean;
  isBuiltIn: boolean;
  displayOrder: number;
  updatedAt: number;
}

export interface ResearchActivity {
  id: string;
  questionId: string;
  sessionId: string | null;
  providerId: string;
  providerName: string;
  searchQuery: string;
  launchedUrl: string;
  launchedAt: number;
  launchingDeviceId: string;
  status: ResearchActivityStatus;
}

export interface DeviceRecord {
  id: string;
  name: string;
  deviceType: DeviceType;
  ed25519PublicKey: string;
  x25519PublicKey: string;
  fingerprint: string;
  trustStatus: DeviceTrustStatus;
  pairedAt: number;
  lastConnectedAt: number | null;
  lastSyncedAt: number | null;
  questionsCreatedCount: number;
  questionsReceivedCount: number;
  keyVersion: number;
  wrappedLibraryKey?: string;
}

export interface DeviceHistoryEvent {
  id: string;
  deviceId: string;
  deviceName: string;
  action: 'initialized' | 'paired' | 'renamed' | 'synced' | 'revoked' | 'key_rotated' | 'rejected';
  details: string;
  timestamp: number;
}

export type QuestionHistoryAction =
  | 'created'
  | 'edited'
  | 'received'
  | 'synchronized'
  | 'completed'
  | 'reopened'
  | 'archived'
  | 'deleted'
  | 'restored'
  | 'conflict_resolved';

export interface QuestionDeviceHistoryEvent {
  id: string;
  questionId: string;
  deviceId: string;
  deviceName: string;
  action: QuestionHistoryAction;
  timestamp: number;
  operationId: string;
  summary: string;
}

export type SyncEntityType =
  | 'question'
  | 'category'
  | 'tag'
  | 'question_tag'
  | 'attachment'
  | 'research_session'
  | 'research_note'
  | 'research_resource'
  | 'related_question';

export type SyncOperationType = 'create' | 'update' | 'delete' | 'restore';

export interface SyncOperation {
  operationId: string;
  entityType: SyncEntityType;
  entityId: string;
  deviceId: string;
  deviceName: string;
  entityRevision: number;
  baseRevision: number;
  versionVector: VersionVector;
  operationType: SyncOperationType;
  timestamp: number;
  changedFields?: string[];
  payload: Record<string, unknown>;
  payloadHash: string;
  signature?: string;
}

export interface SyncCheckpoint {
  peerDeviceId: string;
  lastAckedTimestamp: number;
  lastAckedOperationIds: string[];
  lastSyncDirection: 'push' | 'pull' | 'bidirectional';
  lastSyncStatus: 'success' | 'partial' | 'failed';
  lastSyncSummary: string;
  updatedAt: number;
}

export interface ConflictRecord {
  id: string;
  entityType: 'question' | 'research_note';
  entityId: string;
  field: 'title' | 'description' | 'categoryId' | 'priority' | 'status';
  localValue: string;
  remoteValue: string;
  localDeviceId: string;
  localDeviceName: string;
  remoteDeviceId: string;
  remoteDeviceName: string;
  localTimestamp: number;
  remoteTimestamp: number;
  resolved: boolean;
  resolutionChoice?: 'local' | 'remote' | 'merged';
  resolvedAt?: number;
  createdAt: number;
}

export interface BackupRecord {
  id: string;
  kind: 'manual_qbk' | 'auto_peer_snapshot';
  fileName: string;
  targetDescription: string;
  checksumSha256: string;
  sizeBytes: number;
  questionCount: number;
  attachmentCount: number;
  status: 'verified' | 'failed';
  createdAt: number;
  snapshotPayload?: string; // Stored only for auto peer snapshot transfer buffer
}

export interface AppPreference {
  key: string;
  value: string;
  updatedAt: number;
}

export interface GeneralPreferences {
  appName: string;
  theme: 'light' | 'dark' | 'system';
  language: string;
  dateFormat: 'MMM d, yyyy' | 'yyyy-MM-dd' | 'dd/MM/yyyy';
  defaultPriority: QuestionPriority;
  defaultCategoryId: string;
  autoSyncOnConnect: boolean;
  signalingUrl: string;
  localCompanionUrl: string;
  stunServers: string[];
  turnServerUrl: string;
  turnUsername: string;
  appLockEnabled: boolean;
  localEncryptionEnabled: boolean;
  autoBackupEnabled: boolean;
  retentionDaily: number;
  retentionWeekly: number;
  retentionMonthly: number;
  aiFeaturesEnabled: boolean;
  aiProviderEndpoint: string;
}
