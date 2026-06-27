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
      salt: asArrayBuffer(salt),
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
      iv: asArrayBuffer(iv)
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

export async function decryptNoteContent(
  payload: EncryptedNoteContent,
  secret: string
): Promise<string> {
  try {
    if (!globalThis.crypto?.subtle) {
      return decodeURIComponent(escape(atob(payload.cipherText)));
    }

    const key = await deriveKey(secret, base64ToUint8(payload.salt));
    const decrypted = await globalThis.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: asArrayBuffer(base64ToUint8(payload.iv))
      },
      key,
      asArrayBuffer(base64ToUint8(payload.cipherText))
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    return decodeLegacyPayload(payload.cipherText);
  }
}

async function deriveKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const baseKey = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return globalThis.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: asArrayBuffer(salt),
      iterations: 100000,
      hash: "SHA-256"
    },
    baseKey,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
}

function base64ToUint8(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

function decodeLegacyPayload(value: string): string {
  try {
    return decodeURIComponent(escape(atob(value)));
  } catch {
    return "";
  }
}
