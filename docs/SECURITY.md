# Security Architecture

## Cryptographic Primitives (`@noble/curves`, `@noble/ciphers`, `@noble/hashes`)

- **Device Identity Signatures**: `Ed25519` (`@noble/curves/ed25519.js`)
- **Key Agreement**: `X25519` ECDH + `HKDF-SHA256` (`questbook-sync-v1` / `questbook-keywrap-v1`)
- **Authenticated Encryption**: `XChaCha20-Poly1305` (`@noble/ciphers/chacha.js`) with 24-byte random nonces and domain-separated AAD
- **Password Key Derivation**: `Argon2id` (`t=2, m=16384, p=1, dkLen=32`) with random 16-byte salts for `.qbk` archives and App Lock passcodes
- **Integrity Hashing**: `SHA-256` for operation hashes, attachment deduplication, and backup verification

## Threat Mitigations

- **QR Pairing**: Single-use, 5-minute expiring tokens; QR payloads contain public keys and fingerprints only—never private keys or question data.
- **Untrusted Custom Provider URLs**: `validateProviderUrlTemplate()` restricts protocols strictly to `http:` and `https:`, blocking `javascript:`, `data:`, `vbscript:`, `file:`, and malformed URLs.
- **Lost Device Workflow**: Revoking a device marks its trust status `revoked`, blocks future sync operations, generates a fresh 256-bit library master key, and re-wraps it via X25519 for all remaining trusted peers.

## Browser Storage Limitations

IndexedDB is sandboxed per origin and is **not** hardware-backed encrypted at rest by default. Enabling **Local Encryption** in Settings encrypts sensitive question fields (`title`, `description`, `conclusion`) with XChaCha20-Poly1305, while the device key resides in IndexedDB (`localSecrets`). On shared computers, always enable OS full-disk encryption, set an App Lock passcode, and keep backups offline in `.qbk` archives.
