import {
  ConflictRecord,
  DeviceRecord,
  Question,
  QuestionDeviceHistoryEvent,
  ResearchNote,
  SyncOperation,
  VersionVector,
} from '../types/questbook';
import { sha256Hex } from './crypto';

export type VectorRelation = 'equal' | 'before' | 'after' | 'concurrent';

export function incrementVector(vector: VersionVector, deviceId: string): VersionVector {
  return {
    ...vector,
    [deviceId]: (vector[deviceId] ?? 0) + 1,
  };
}

export function mergeVectors(a: VersionVector, b: VersionVector): VersionVector {
  const merged: VersionVector = { ...a };
  for (const [k, v] of Object.entries(b)) {
    merged[k] = Math.max(merged[k] ?? 0, v);
  }
  return merged;
}

export function compareVectors(a: VersionVector, b: VersionVector): VectorRelation {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let aGreater = false;
  let bGreater = false;
  for (const key of keys) {
    const va = a[key] ?? 0;
    const vb = b[key] ?? 0;
    if (va > vb) aGreater = true;
    if (vb > va) bGreater = true;
  }
  if (!aGreater && !bGreater) return 'equal';
  if (aGreater && !bGreater) return 'after';
  if (bGreater && !aGreater) return 'before';
  return 'concurrent';
}

export type SyncProtocolMessageType =
  | 'HELLO'
  | 'AUTH'
  | 'SYNC_REQUEST'
  | 'SYNC_SUMMARY'
  | 'CHANGE_BATCH'
  | 'ATTACHMENT_REQUEST'
  | 'ATTACHMENT_CHUNK'
  | 'ACK'
  | 'CONFLICT'
  | 'SYNC_COMPLETE'
  | 'ERROR';

export interface SyncProtocolMessage<T = unknown> {
  protocolVersion: '1.0';
  type: SyncProtocolMessageType;
  senderDeviceId: string;
  targetDeviceId?: string;
  timestamp: number;
  payload: T;
}

export function createSyncMessage<T>(
  type: SyncProtocolMessageType,
  senderDeviceId: string,
  payload: T,
  targetDeviceId?: string,
): SyncProtocolMessage<T> {
  return {
    protocolVersion: '1.0',
    type,
    senderDeviceId,
    targetDeviceId,
    timestamp: Date.now(),
    payload,
  };
}

export interface QuestionMergeResult {
  merged: Question;
  conflicts: ConflictRecord[];
  historyEvent: QuestionDeviceHistoryEvent;
}

export function mergeQuestionOperation(
  local: Question | undefined,
  op: SyncOperation,
  senderDevice: Pick<DeviceRecord, 'id' | 'name' | 'trustStatus'>,
  receivingDeviceId: string,
): QuestionMergeResult {
  if (senderDevice.trustStatus === 'revoked') {
    throw new Error(`Rejected operation from revoked device "${senderDevice.name}" (${senderDevice.id}).`);
  }

  const remote = op.payload as unknown as Question;
  const now = Date.now();

  // New question arriving from another device: preserve original createdDeviceId!
  if (!local) {
    const created: Question = {
      ...remote,
      lastSyncedFromDeviceId: senderDevice.id,
      lastSyncedFromDeviceName: senderDevice.name,
      lastSyncedAt: now,
    };
    return {
      merged: created,
      conflicts: [],
      historyEvent: {
        id: `${op.operationId}:rx`,
        questionId: created.id,
        deviceId: senderDevice.id,
        deviceName: senderDevice.name,
        action: 'received',
        timestamp: now,
        operationId: op.operationId,
        summary: `Received from ${senderDevice.name} (originally created on ${created.createdDeviceName})`,
      },
    };
  }

  const relation = compareVectors(local.versionVector, remote.versionVector);

  // Local is strictly newer or equal -> keep local values but update sync metadata & merge vector
  if (relation === 'equal' || relation === 'after') {
    return {
      merged: {
        ...local,
        versionVector: mergeVectors(local.versionVector, remote.versionVector),
      },
      conflicts: [],
      historyEvent: {
        id: `${op.operationId}:skip`,
        questionId: local.id,
        deviceId: senderDevice.id,
        deviceName: senderDevice.name,
        action: 'synchronized',
        timestamp: now,
        operationId: op.operationId,
        summary: `Acked older/equal operation from ${senderDevice.name}`,
      },
    };
  }

  // Remote is strictly newer -> apply remote, NEVER overwrite createdDeviceId / createdDeviceName!
  if (relation === 'before') {
    const merged: Question = {
      ...remote,
      createdDeviceId: local.createdDeviceId,
      createdDeviceName: local.createdDeviceName,
      createdAt: local.createdAt,
      lastSyncedFromDeviceId: senderDevice.id,
      lastSyncedFromDeviceName: senderDevice.name,
      lastSyncedAt: now,
      versionVector: mergeVectors(local.versionVector, remote.versionVector),
    };
    return {
      merged,
      conflicts: [],
      historyEvent: {
        id: `${op.operationId}:apply`,
        questionId: local.id,
        deviceId: senderDevice.id,
        deviceName: senderDevice.name,
        action: op.operationType === 'delete' ? 'deleted' : op.operationType === 'restore' ? 'restored' : 'synchronized',
        timestamp: now,
        operationId: op.operationId,
        summary: `Updated via sync from ${senderDevice.name}`,
      },
    };
  }

  // CONCURRENT EDIT! Apply field-aware conflict rules (do NOT silently use LWW!)
  const conflicts: ConflictRecord[] = [];

  const checkConflictField = (
    field: ConflictRecord['field'],
    localVal: string,
    remoteVal: string,
  ) => {
    if (localVal !== remoteVal) {
      conflicts.push({
        id: `${local.id}:${field}:${op.operationId}`,
        entityType: 'question',
        entityId: local.id,
        field,
        localValue: localVal,
        remoteValue: remoteVal,
        localDeviceId: local.lastModifiedDeviceId || receivingDeviceId,
        localDeviceName: local.createdDeviceName,
        remoteDeviceId: senderDevice.id,
        remoteDeviceName: senderDevice.name,
        localTimestamp: local.updatedAt,
        remoteTimestamp: remote.updatedAt,
        resolved: false,
        createdAt: now,
      });
    }
  };

  checkConflictField('title', local.title, remote.title);
  checkConflictField('description', local.description, remote.description);
  checkConflictField('categoryId', local.categoryId, remote.categoryId);

  // Merge keyFindings as union without overwriting
  const mergedFindings = Array.from(new Set([...(local.keyFindings ?? []), ...(remote.keyFindings ?? [])]));

  // Status: prefer higher lifecycle progression unless explicitly flagged, or preserve active exploration
  const statusRank: Record<Question['status'], number> = {
    new: 0,
    unexplored: 1,
    exploring: 2,
    completed: 3,
  };
  const mergedStatus =
    statusRank[remote.status] > statusRank[local.status] ? remote.status : local.status;

  // Priority: deterministic policy (High > Medium > Low) when concurrent
  const priorityRank: Record<Question['priority'], number> = {
    high: 3,
    medium: 2,
    low: 1,
  };
  const mergedPriority =
    priorityRank[remote.priority] > priorityRank[local.priority] ? remote.priority : local.priority;

  // Tombstone deletion safety: if one device deleted and the other edited concurrently, keep recoverable or flag
  const mergedDeletedAt = local.deletedAt && remote.deletedAt ? Math.min(local.deletedAt, remote.deletedAt) : null;

  const merged: Question = {
    ...local,
    keyFindings: mergedFindings,
    status: mergedStatus,
    priority: mergedPriority,
    conclusion:
      local.conclusion && remote.conclusion && local.conclusion !== remote.conclusion
        ? `${local.conclusion}\n\n--- Synced from ${senderDevice.name} ---\n${remote.conclusion}`
        : local.conclusion || remote.conclusion,
    isFavorite: local.isFavorite || remote.isFavorite,
    isPinned: local.isPinned || remote.isPinned,
    deletedAt: mergedDeletedAt,
    revision: Math.max(local.revision, remote.revision) + 1,
    versionVector: incrementVector(mergeVectors(local.versionVector, remote.versionVector), receivingDeviceId),
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    lastSyncedFromDeviceId: senderDevice.id,
    lastSyncedFromDeviceName: senderDevice.name,
    lastSyncedAt: now,
  };

  return {
    merged,
    conflicts,
    historyEvent: {
      id: `${op.operationId}:merge`,
      questionId: local.id,
      deviceId: senderDevice.id,
      deviceName: senderDevice.name,
      action: 'synchronized',
      timestamp: now,
      operationId: op.operationId,
      summary:
        conflicts.length > 0
          ? `Concurrent edit from ${senderDevice.name} flagged ${conflicts.length} conflict(s) for review`
          : `Merged non-conflicting concurrent changes from ${senderDevice.name}`,
    },
  };
}

export function mergeResearchNote(local: ResearchNote | undefined, remote: ResearchNote): ResearchNote {
  if (!local) return remote;
  const rel = compareVectors(local.versionVector, remote.versionVector);
  if (rel === 'before') {
    return {
      ...remote,
      createdDeviceId: local.createdDeviceId,
      createdDeviceName: local.createdDeviceName,
      versionVector: mergeVectors(local.versionVector, remote.versionVector),
    };
  }
  if (rel === 'concurrent' && local.content !== remote.content) {
    // Preserve independent notes rather than overwriting
    return {
      ...local,
      content: `${local.content}\n\n[Concurrent note from ${remote.createdDeviceName}]:\n${remote.content}`,
      versionVector: mergeVectors(local.versionVector, remote.versionVector),
      updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    };
  }
  return local;
}

export function filterMissingOperations(
  allOps: SyncOperation[],
  alreadySeenOpIds: Set<string>,
  sinceTimestamp = 0,
): SyncOperation[] {
  return allOps
    .filter((op) => !alreadySeenOpIds.has(op.operationId) && op.timestamp >= sinceTimestamp)
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function computeOperationHash(op: Omit<SyncOperation, 'payloadHash' | 'signature'>): string {
  return sha256Hex(
    JSON.stringify({
      operationId: op.operationId,
      entityType: op.entityType,
      entityId: op.entityId,
      deviceId: op.deviceId,
      entityRevision: op.entityRevision,
      operationType: op.operationType,
      timestamp: op.timestamp,
      payload: op.payload,
    }),
  );
}
