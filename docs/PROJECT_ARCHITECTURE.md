# Project Architecture

## Layer Separation

| Layer | Directory / File | Responsibility |
| --- | --- | --- |
| Pure Domain Logic | `src/core/` | Cryptography (`crypto.ts`), URL validation & launcher (`urlLauncher.ts`), causal sync & conflict resolution (`syncEngine.ts`), search & duplicate detection (`search.ts`), `.qbk` archive encryption & retention (`backup.ts`) |
| Local Persistence | `src/db/` | Dexie.js versioned IndexedDB schema (`database.ts`) and transactional repository + change journal (`repository.ts`) |
| Transport & Signaling | `server.ts`, `src/services/syncClient.ts` | Zero-knowledge Express + WebSocket signaling/relay (`server.ts`) and browser WebSocket + WebRTC DataChannel transport (`syncClient.ts`) |
| Native Companion | `companion/main.py` | Python FastAPI service for mDNS (`zeroconf`), local Wi-Fi WS relay (`:8765`), and disk-based `.qbk` snapshots |
| UI & Navigation | `src/components/`, `src/pages/`, `src/hooks/` | 15 modular views, reactive Dexie `liveQuery` state, PWA install prompt, offline indicator |

## Browser / PWA vs Native Companion Boundary

- **Supported directly in PWA**: IndexedDB persistence, offline service worker (`vite-plugin-pwa`), Web Share Target (`GET /capture`), SpeechRecognition where supported, camera/file image upload, WebCrypto/`@noble` encryption, QR code generation, WebSocket & WebRTC DataChannel sync.
- **Requires Python FastAPI Companion or future Tauri/Capacitor wrapper**: Raw UDP mDNS/DNS-SD service broadcast, always-on background sync daemon when browser tabs are closed, arbitrary external disk/NAS folder writes without browser Save As prompts.
