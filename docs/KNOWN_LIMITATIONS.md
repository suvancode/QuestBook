# Known Limitations

1. **Browser Sandbox & LAN Discovery**: Browsers cannot natively broadcast or listen for mDNS/DNS-SD (`_questbook._tcp.local.`) or bind a raw TCP/WebSocket server on port 8765. Use the included Python FastAPI companion (`companion/main.py`) for native LAN discovery and local disk backups.
2. **Voice Capture**: Relies on the browser's `SpeechRecognition` / `webkitSpeechRecognition` API, which may require internet connectivity depending on browser vendor and is unavailable in Firefox/some headless environments. Manual text fallback is always available.
3. **Web Share Target**: Direct OS share-sheet integration works on installed Android/Chromium PWAs; iOS Safari and desktop browsers without share-target support can open `/capture` directly.
4. **External AI Platforms**: Opening ChatGPT, Gemini, Claude, Perplexity, Grok, Copilot, or You.com opens their web UI with your question pre-filled where supported; responses are **not** scraped automatically. Automatic retrieval requires explicit API configuration.
5. **Browser Storage Eviction & Revocation**: IndexedDB is not hardware-encrypted by default and can be cleared by OS storage pressure unless persistent storage is granted. Revoking a lost device prevents future syncs and rotates keys for remaining peers, but cannot remotely wipe data already stored on the lost device.
6. **NAT Traversal**: WebRTC P2P across restrictive symmetric NATs requires an external TURN server configured in Settings.
