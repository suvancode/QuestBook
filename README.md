# QuestBook

**Capture Curiosity. Discover Knowledge.**

QuestBook is an offline-first, cloudless, privacy-focused personal question management and research discovery workspace built with React, TypeScript, Dexie.js (IndexedDB), WebSockets, WebRTC DataChannels, and audited `@noble/*` cryptography.

## Core Philosophy

**Capture now. Explore later. Never forget a question.**

- **Offline-first local vault**: Every question, tag, attachment, research session, note, and saved reference lives locally in your browser's IndexedDB (`QuestBookLocalDB`) — no centralized cloud database required.
- **5-second capture**: Text capture (only title required), browser speech-to-text voice capture (with manual fallback), image/screenshot/camera upload, and PWA Web Share Target ingestion (`/capture`).
- **External Research Launcher**: Launch questions across 11 built-in search & AI platforms plus custom URL-template providers, supporting single launch, default provider, **Search All (all enabled)**, and **Choose Platforms (checklist)**.
- **Cloudless Multi-Device Sync & Origin Tracking**: Pair devices via single-use expiring QR payloads (`Ed25519` + `X25519` + `XChaCha20-Poly1305`), preserve `createdDeviceId` permanently alongside `lastSyncedFromDeviceId`, and resolve concurrent edits via causal version vectors instead of blind last-write-wins.
- **Encrypted `.qbk` Backups**: Export and verify password-protected archives derived with `Argon2id` and authenticated with `XChaCha20-Poly1305` + `SHA-256`.

## Running Locally

```bash
npm install
npm run dev       # Starts Express + zero-knowledge WS relay + Vite on http://localhost:3000
npm test          # Runs node:test cryptographic, sync, search, URL, and backup tests
npm run lint      # Type-checks TypeScript
npm run build     # Builds production PWA bundle into dist/
```

## Optional Python FastAPI Local Companion

For native LAN mDNS discovery (`_questbook._tcp.local.`) and local filesystem `.qbk` backup storage outside the browser sandbox, see `companion/README.md`.

## Documentation Index

- `docs/PROJECT_ARCHITECTURE.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/SYNC_PROTOCOL.md`
- `docs/SECURITY.md`
- `docs/BACKUP_AND_RECOVERY.md`
- `docs/API_DOCUMENTATION.md`
- `docs/DEVELOPMENT_GUIDE.md`
- `docs/DEPLOYMENT_GUIDE.md`
- `docs/TESTING_GUIDE.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/ROADMAP.md`
