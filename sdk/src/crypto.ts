import * as crypto from "crypto";
import nacl from "tweetnacl";

/**
 * Hash proof text using SHA-256 (for on-chain commitment).
 */
export function hashProof(proof: string | Buffer): Buffer {
  const data = typeof proof === "string" ? Buffer.from(proof) : proof;
  return crypto.createHash("sha256").update(data).digest();
}

/**
 * Generate an X25519 keypair for encrypted disclosures.
 */
export function generateEncryptionKeypair(): {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
} {
  return nacl.box.keyPair();
}

/**
 * Encrypt proof using NaCl box (X25519-XSalsa20-Poly1305).
 * @param proof - The plaintext proof to encrypt
 * @param recipientPublicKey - Protocol's X25519 public key (32 bytes)
 * @param senderSecretKey - Hacker's X25519 secret key
 * @returns Encrypted proof with nonce prepended (nonce + ciphertext)
 */
export function encryptProof(
  proof: string | Buffer,
  recipientPublicKey: Uint8Array,
  senderSecretKey: Uint8Array
): Buffer {
  const data =
    typeof proof === "string" ? Buffer.from(proof) : proof;
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const encrypted = nacl.box(data, nonce, recipientPublicKey, senderSecretKey);

  if (!encrypted) {
    throw new Error("Encryption failed");
  }

  // Prepend nonce to ciphertext: [24 bytes nonce][ciphertext]
  return Buffer.concat([Buffer.from(nonce), Buffer.from(encrypted)]);
}

/**
 * Decrypt proof using NaCl box.
 * @param encryptedProof - Nonce + ciphertext from encryptProof()
 * @param senderPublicKey - Hacker's X25519 public key (32 bytes)
 * @param recipientSecretKey - Protocol's X25519 secret key
 * @returns Decrypted plaintext proof
 */
export function decryptProof(
  encryptedProof: Buffer | Uint8Array,
  senderPublicKey: Uint8Array,
  recipientSecretKey: Uint8Array
): Buffer {
  const buf = Buffer.from(encryptedProof);
  const nonce = buf.subarray(0, nacl.box.nonceLength);
  const ciphertext = buf.subarray(nacl.box.nonceLength);

  const decrypted = nacl.box.open(
    ciphertext,
    nonce,
    senderPublicKey,
    recipientSecretKey
  );

  if (!decrypted) {
    throw new Error("Decryption failed — wrong key or tampered data");
  }

  return Buffer.from(decrypted);
}
