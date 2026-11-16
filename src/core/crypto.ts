import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { argon2id } from '@noble/hashes/argon2.js';
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils.js';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const utf8ToBytes = (str: string) => textEncoder.encode(str);
const bytesToUtf8 = (bytes: Uint8Array) => textDecoder.decode(bytes);

export interface DeviceKeyMaterial {
  ed25519SecretKeyHex: string;
  ed25519PublicKeyHex: string;
  x25519SecretKeyHex: string;
  x25519PublicKeyHex: string;
  fingerprint: string;
}

export function generateDeviceKeyMaterial(): DeviceKeyMaterial {
  const ed = ed25519.keygen();
  const x = x25519.keygen();
  const edPubHex = bytesToHex(ed.publicKey);
  return {
    ed25519SecretKeyHex: bytesToHex(ed.secretKey),
    ed25519PublicKeyHex: edPubHex,
    x25519SecretKeyHex: bytesToHex(x.secretKey),
    x25519PublicKeyHex: bytesToHex(x.publicKey),
    fingerprint: computeFingerprint(edPubHex),
  };
}

export function computeFingerprint(publicKeyHex: string): string {
  const digest = sha256(hexToBytes(publicKeyHex));
  const hex = bytesToHex(digest).slice(0, 32).toUpperCase();
  return hex.match(/.{1,4}/g)?.join('-') ?? hex;
}

export function sha256Hex(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? utf8ToBytes(input) : input;
  return bytesToHex(sha256(bytes));
}

export function signPayload(message: string, secretKeyHex: string): string {
  const sig = ed25519.sign(utf8ToBytes(message), hexToBytes(secretKeyHex));
  return bytesToHex(sig);
}

export function verifySignature(message: string, signatureHex: string, publicKeyHex: string): boolean {
  try {
    return ed25519.verify(hexToBytes(signatureHex), utf8ToBytes(message), hexToBytes(publicKeyHex));
  } catch {
    return false;
  }
}

export function deriveSharedSessionKey(
  myX25519SecretHex: string,
  peerX25519PublicHex: string,
  saltInfo = 'questbook-sync-v1',
): Uint8Array {
  const shared = x25519.getSharedSecret(hexToBytes(myX25519SecretHex), hexToBytes(peerX25519PublicHex));
  return hkdf(sha256, shared, utf8ToBytes('questbook-salt'), utf8ToBytes(saltInfo), 32);
}

export function derivePasswordKey(password: string, salt: Uint8Array): Uint8Array {
  return argon2id(utf8ToBytes(password), salt, {
    t: 2,
    m: 16384,
    p: 1,
    dkLen: 32,
  });
}

export function encryptText(plaintext: string, key32: Uint8Array, aad?: string): { nonceHex: string; cipherHex: string } {
  const nonce = randomBytes(24);
  const cipher = aad
    ? xchacha20poly1305(key32, nonce, utf8ToBytes(aad))
    : xchacha20poly1305(key32, nonce);
  const encrypted = cipher.encrypt(utf8ToBytes(plaintext));
  return {
    nonceHex: bytesToHex(nonce),
    cipherHex: bytesToHex(encrypted),
  };
}

export function decryptText(cipherHex: string, nonceHex: string, key32: Uint8Array, aad?: string): string {
  const nonce = hexToBytes(nonceHex);
  const cipher = aad
    ? xchacha20poly1305(key32, nonce, utf8ToBytes(aad))
    : xchacha20poly1305(key32, nonce);
  const decrypted = cipher.decrypt(hexToBytes(cipherHex));
  return bytesToUtf8(decrypted);
}

export function generateRandomKeyHex(bytes = 32): string {
  return bytesToHex(randomBytes(bytes));
}

export function wrapLibraryKeyForPeer(
  libraryKeyHex: string,
  myX25519SecretHex: string,
  peerX25519PublicHex: string,
): { nonceHex: string; cipherHex: string } {
  const shared = deriveSharedSessionKey(myX25519SecretHex, peerX25519PublicHex, 'questbook-keywrap-v1');
  return encryptText(libraryKeyHex, shared, 'library-key');
}

export function unwrapLibraryKeyFromPeer(
  wrapped: { nonceHex: string; cipherHex: string },
  myX25519SecretHex: string,
  peerX25519PublicHex: string,
): string {
  const shared = deriveSharedSessionKey(myX25519SecretHex, peerX25519PublicHex, 'questbook-keywrap-v1');
  return decryptText(wrapped.cipherHex, wrapped.nonceHex, shared, 'library-key');
}

export function generatePairingToken(): string {
  return bytesToHex(randomBytes(16));
}

export { bytesToHex, hexToBytes, randomBytes };
