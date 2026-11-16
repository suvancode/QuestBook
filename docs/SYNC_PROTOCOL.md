# QuestBook Sync Protocol (`v1.0`)

Transport-independent protocol implemented in `src/core/syncEngine.ts` and `src/services/syncClient.ts`.

## Supported Transports

1. **WebSocket Relay (`server.ts` `/ws/sync` or Python Companion `:8765/ws/sync`)**: Zero-knowledge forwarding of encrypted envelopes.
2. **WebRTC DataChannel (`questbook-sync-v1`)**: Direct peer-to-peer encrypted channel negotiated via ephemeral SDP/ICE signaling + STUN/optional TURN.

## Protocol Messages

`HELLO`, `AUTH`, `SYNC_REQUEST`, `SYNC_SUMMARY`, `CHANGE_BATCH`, `ATTACHMENT_REQUEST`, `ATTACHMENT_CHUNK`, `ACK`, `CONFLICT`, `SYNC_COMPLETE`, `ERROR`.

## Device Origin & Causal Rules

- `createdDeviceId` and `createdDeviceName` are immutable once created and preserved across multi-hop syncs (`Phone -> Laptop -> Tablet`).
- `lastSyncedFromDeviceId` and `lastSyncedFromDeviceName` always record the immediate sending peer.
- Concurrent edits are detected via `compareVectors(local.versionVector, remote.versionVector) === 'concurrent'` rather than wall-clock timestamps.
- Concurrent `title`, `description`, or `categoryId` edits generate `ConflictRecord` entries preserving both values; concurrent `researchNotes` are concatenated/preserved rather than overwritten.
- Operations from `revoked` devices are rejected immediately and logged in `deviceHistory`.
