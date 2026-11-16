# Testing Guide

## Unit Tests (`node:test`)

```bash
npm test
```

Covers:
- `src/core/crypto.test.ts`: Ed25519 sign/verify, X25519+HKDF key agreement, XChaCha20-Poly1305 AEAD & AAD tamper rejection, Argon2id KDF, key wrapping.
- `src/core/urlLauncher.test.ts`: URL scheme validation (`javascript:`/`data:` rejection), `{query}` encoding, Search All Mode A & Checklist Mode B.
- `src/core/syncEngine.test.ts`: 3-device origin tracking (`Phone -> Laptop -> Tablet`), concurrent edit conflict detection under clock skew, revoked device blocking, research note preservation, operation deduplication.
- `src/core/search.test.ts`: Multi-facet filtering, 1,200-question latency benchmark (<100ms), duplicate title detection.
- `src/core/backup.test.ts`: `.qbk` archive round-trip, wrong password & tampered ciphertext rejection, retention policy evaluation.

## End-to-End Browser Verification

Verified against the live running server on `http://localhost:3000` using headless Chromium (`playwright-cli`), covering quick capture, IndexedDB persistence across reload, search/filtering, research workspace & external launcher checklist mode, custom provider URL validation, QR pairing generation, sync conflict view, and backup/restore validation.
