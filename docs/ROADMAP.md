# QuestBook Roadmap

## Implemented in Current Release

- **Phase 1 (Foundation)**: React + TypeScript + Tailwind UI, Dexie.js v2 IndexedDB schema, quick text capture, full CRUD, 11 default + custom categories, tags, priorities, statuses, favorites/pins, local keyword search, offline persistence.
- **Phase 2 (Capture & Research)**: Voice capture (with fallback), image/camera attachments, Web Share Target handler, Research Workspace, multi-session research, notes & provider comparison, saved resources, related questions, question device history.
- **Phase 3 (External Research Launcher)**: 11 built-in search & AI providers, Custom Provider Manager, configurable default provider, Mode A (Search All Enabled) & Mode B (Checklist), URL scheme validation, research launch activity tracking.
- **Phase 4 (Device Identity & Pairing)**: Ed25519 + X25519 device identities, single-use expiring QR pairing, fingerprint confirmation, Device Manager, device revocation with key rotation, permanent `createdDeviceId` vs `lastSyncedFromDeviceId` tracking.
- **Phase 5 & 6 (Local & Remote P2P Sync)**: Transport-independent QuestBook Sync Protocol, Express zero-knowledge WebSocket relay (`server.ts`), WebRTC DataChannel P2P transport (`syncClient.ts`), Python FastAPI mDNS companion (`companion/main.py`).
- **Phase 7 (Conflicts & Backups)**: Causal version vectors, field-aware conflict resolution UI, tombstones & Trash, encrypted `.qbk` backup/restore (Argon2id + XChaCha20-Poly1305 + SHA-256), peer snapshot retention policy.
- **Phase 8 (Hardening & Verification)**: Explore/Rediscovery, optional reminders, App Lock, local field encryption toggle, PWA manifest + Workbox service worker, unit test suite + browser verification.

## Future Modular Extensions (Opt-In Only)

- Local/configured Semantic Search embeddings (`SemanticSearchExtension` in `src/core/search.ts`)
- Client-side OCR for screenshot attachments (e.g. Tesseract.js WASM)
- Native Tauri desktop & Capacitor mobile wrappers using the same `src/core/` and `src/db/` modules
- Interactive Knowledge Graph visualization of `relatedQuestions`
