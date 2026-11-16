# Database Schema (`QuestBookLocalDB`)

Managed via **Dexie.js** (`src/db/database.ts`) with explicit schema versioning and transactional multi-table writes.

## Version History

- **v1**: Initial 20 domain stores + `localSecrets` isolated key store.
- **v2**: Added `lastResearchedAt` index on `questions` and `keyVersion` index + upgrade migration on `devices`.

## Entities (20 + Local Secret Store)

1. `questions`: Primary UUID, `title`, `description`, `categoryId`, `priority`, `status`, `sourceType`, `isPinned`, `isFavorite`, `conclusion`, `keyFindings`, `revision`, `versionVector`, `createdAt`, `updatedAt`, `lastResearchedAt`, `archivedAt`, `deletedAt`, `createdDeviceId`, `createdDeviceName`, `lastModifiedDeviceId`, `lastSyncedFromDeviceId`, `lastSyncedFromDeviceName`, `lastSyncedAt`, optional `encryptedPayload`.
2. `categories`: Default 11 categories + custom user categories.
3. `tags`: Normalized lowercase tag dictionary.
4. `questionTags`: Many-to-many join records (`${questionId}:${tagId}`) with tombstone `deletedAt`.
5. `attachments`: Image attachments with `sha256` content hash for sync deduplication.
6. `researchSessions`: Multiple sessions per question (`active | paused | completed`).
7. `researchNotes`: Provider-attributed findings with causal `versionVector`.
8. `researchResources`: Validated external URLs and citation notes.
9. `relatedQuestions`: Directed links (`prerequisite | follow_up | contradicts | related`).
10. `reminders`: Optional gentle review dates.
11. `searchProviders`: Built-in 11 + custom URL-template providers.
12. `researchActivities`: Launch audit log (`opened | in_progress | completed`).
13. `devices`: Self and paired/revoked peer devices with Ed25519/X25519 public keys and fingerprints.
14. `deviceHistory`: Pairing, rename, revocation, and key rotation audit trail.
15. `questionDeviceHistory`: Per-question origin and synchronization timeline.
16. `syncOperations`: Append-only change journal with `operationId`, `versionVector`, `payloadHash`, and Ed25519 `signature`.
17. `syncCheckpoints`: Per-peer last acknowledged operation IDs and summary.
18. `conflicts`: Unresolved concurrent field edits awaiting user decision.
19. `backups`: Manual `.qbk` and automatic peer snapshot metadata.
20. `preferences`: Local application settings (`general`).
21. `localSecrets` (non-synced): Device Ed25519/X25519 private keys, library master key, and optional Argon2id App Lock hash.
