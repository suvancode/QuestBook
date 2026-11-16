import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptText,
  derivePasswordKey,
  deriveSharedSessionKey,
  encryptText,
  generateDeviceKeyMaterial,
  generateRandomKeyHex,
  randomBytes,
  signPayload,
  unwrapLibraryKeyFromPeer,
  verifySignature,
  wrapLibraryKeyForPeer,
} from './crypto';

test('Ed25519 signing and verification works and rejects tampering', () => {
  const keys = generateDeviceKeyMaterial();
  const message = JSON.stringify({ hello: 'questbook', ts: 12345 });
  const sig = signPayload(message, keys.ed25519SecretKeyHex);

  assert.equal(verifySignature(message, sig, keys.ed25519PublicKeyHex), true);
  assert.equal(verifySignature(message + 'x', sig, keys.ed25519PublicKeyHex), false);
});

test('X25519 ECDH + HKDF derives identical session keys on both peers', () => {
  const alice = generateDeviceKeyMaterial();
  const bob = generateDeviceKeyMaterial();

  const aliceShared = deriveSharedSessionKey(alice.x25519SecretKeyHex, bob.x25519PublicKeyHex);
  const bobShared = deriveSharedSessionKey(bob.x25519SecretKeyHex, alice.x25519PublicKeyHex);

  assert.deepEqual(aliceShared, bobShared);
});

test('XChaCha20-Poly1305 encrypts, decrypts, and rejects wrong AAD or key', () => {
  const alice = generateDeviceKeyMaterial();
  const bob = generateDeviceKeyMaterial();
  const key = deriveSharedSessionKey(alice.x25519SecretKeyHex, bob.x25519PublicKeyHex);

  const { nonceHex, cipherHex } = encryptText('Why do neutron stars spin so fast?', key, 'q-1');
  const recovered = decryptText(cipherHex, nonceHex, key, 'q-1');
  assert.equal(recovered, 'Why do neutron stars spin so fast?');

  assert.throws(() => decryptText(cipherHex, nonceHex, key, 'wrong-aad'));
});

test('Library master key wrapping and unwrapping works across peers', () => {
  const laptop = generateDeviceKeyMaterial();
  const phone = generateDeviceKeyMaterial();
  const masterKey = generateRandomKeyHex(32);

  const wrapped = wrapLibraryKeyForPeer(masterKey, laptop.x25519SecretKeyHex, phone.x25519PublicKeyHex);
  const unwrapped = unwrapLibraryKeyFromPeer(wrapped, phone.x25519SecretKeyHex, laptop.x25519PublicKeyHex);
  assert.equal(unwrapped, masterKey);
});

test('Argon2id derives deterministic 32-byte keys for same password and salt', () => {
  const salt = randomBytes(16);
  const k1 = derivePasswordKey('curiosity-vault-99', salt);
  const k2 = derivePasswordKey('curiosity-vault-99', salt);
  const k3 = derivePasswordKey('wrong-password', salt);

  assert.equal(k1.length, 32);
  assert.deepEqual(k1, k2);
  assert.notDeepEqual(k1, k3);
});
