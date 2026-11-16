# API Documentation

## Express Zero-Knowledge Signaling Server (`server.ts`)

- `GET /api/health`: Returns `{ status: "ok", service: "questbook-signaling-relay", storesQuestionData: false, connectedPeers }`.
- `WS /ws/sync`:
  - `REGISTER`: Registers ephemeral online `deviceId` in memory.
  - `PAIR_TOKEN_CREATE`: Registers single-use expiring QR token.
  - `PAIR_TOKEN_CLAIM`: Consumes single-use token and forwards pairing identity to host device.
  - `WEBRTC_OFFER` / `WEBRTC_ANSWER` / `WEBRTC_ICE`: Relays SDP/ICE candidates to `targetDeviceId`.
  - `SYNC_ENVELOPE`: Forwards XChaCha20-Poly1305 encrypted + Ed25519 signed payload to `targetDeviceId` without decryption or persistence.

## Python FastAPI Local Companion (`companion/main.py`)

- `GET /health`: Reports companion status, `mdnsAvailable`, `connectedPeers`, and `backupDir`.
- `POST /backups/save`: Saves a `.qbk` archive to disk (`./questbook_backups/`).
- `GET /backups/list`: Lists `.qbk` backups on disk.
- `WS /ws/sync`: Local LAN WebSocket relay.
