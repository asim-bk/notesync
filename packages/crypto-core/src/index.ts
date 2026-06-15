import type { EncryptedNoteContent } from "@notesync/shared-types";

const ITERATIONS = 150_000;
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;

interface BufferLike {
  from(value: Uint8Array | string, encoding?: string): {
    toString(encoding: string): string;
  };
}

function requireCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto API is not available in this runtime.");
  }

  return globalThis.crypto;
}

function toBase64(bytes: Uint8Array): string {
  const bufferApi = (globalThis as { Buffer?: BufferLike }).Buffer;
  if (bufferApi) {
    return bufferApi.from(bytes).toString("base64");
  }

  let binary = "";
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const bufferApi = (globalThis as { Buffer?: BufferLike }).Buffer;
  if (bufferApi) {
    const raw = bufferApi.from(value, "base64").toString("binary");
    return Uint8Array.from(raw, (char) => char.charCodeAt(0));
  }

  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  requireCrypto().getRandomValues(bytes);
  return bytes;
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

async function deriveAesKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const cryptoApi = requireCrypto();
  const baseKey = await cryptoApi.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return cryptoApi.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: asArrayBuffer(salt),
      iterations: ITERATIONS,
      hash: "SHA-256"
    },
    baseKey,
    {
      name: "AES-GCM",
      length: KEY_LENGTH * 8
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptNoteContent(
  content: string,
  secret: string
): Promise<EncryptedNoteContent> {
  const cryptoApi = requireCrypto();
  const iv = randomBytes(IV_LENGTH);
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveAesKey(secret, salt);
  const cipherBuffer = await cryptoApi.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: asArrayBuffer(iv)
    },
    key,
    new TextEncoder().encode(content)
  );

  return {
    cipherText: toBase64(new Uint8Array(cipherBuffer)),
    iv: toBase64(iv),
    salt: toBase64(salt),
    algorithm: "AES-256-GCM",
    version: 1
  };
}

export async function decryptNoteContent(
  payload: EncryptedNoteContent,
  secret: string
): Promise<string> {
  const cryptoApi = requireCrypto();
  const key = await deriveAesKey(secret, fromBase64(payload.salt));
  const plainBuffer = await cryptoApi.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: asArrayBuffer(fromBase64(payload.iv))
    },
    key,
    asArrayBuffer(fromBase64(payload.cipherText))
  );

  return new TextDecoder().decode(plainBuffer);
}
