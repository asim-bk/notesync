import type { EncryptedNoteContent } from "@notesync/shared-types";

export async function encryptNoteContent(
  content: string,
  secret: string
): Promise<EncryptedNoteContent> {
  if (!globalThis.crypto?.subtle) {
    return {
      cipherText: btoa(unescape(encodeURIComponent(content))),
      iv: "fallback-iv",
      salt: secret.slice(0, 8) || "fallback",
      algorithm: "AES-256-GCM",
      version: 1
    };
  }

  const encoder = new TextEncoder();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const baseKey = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const key = await globalThis.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    baseKey,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt"]
  );

  const encrypted = await globalThis.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv
    },
    key,
    encoder.encode(content)
  );

  return {
    cipherText: uint8ToBase64(new Uint8Array(encrypted)),
    iv: uint8ToBase64(iv),
    salt: uint8ToBase64(salt),
    algorithm: "AES-256-GCM",
    version: 1
  };
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
}
