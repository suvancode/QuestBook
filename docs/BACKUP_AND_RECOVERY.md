# Backup & Recovery

Synchronization is **not** a substitute for independent backups.

## 1. Manual Encrypted `.qbk` Archives

- Format: JSON envelope (`magic: "QBK1"`, `kdf: "argon2id"`, `cipher: "xchacha20-poly1305"`).
- Includes all questions, categories, tags, research sessions, notes, resources, attachments, reminders, search providers, and device history.
- Before restoring, QuestBook decrypts with the supplied recovery password and verifies the `SHA-256` digest of the plaintext payload. Wrong passwords or tampered archives are rejected cleanly without modifying IndexedDB.

## 2. Automatic Peer Snapshots & Retention

- Creates verified encrypted snapshots staged for transfer to trusted peers or the Python Local Companion (`POST /backups/save`).
- Default retention policy (configurable in Settings): Latest snapshot always + 7 daily + 4 weekly + 6 monthly snapshots (`evaluateBackupRetention` in `src/core/backup.ts`).
