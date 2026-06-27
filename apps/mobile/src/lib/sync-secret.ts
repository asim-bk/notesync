function requireSubtleCrypto(): SubtleCrypto | null {
  return globalThis.crypto?.subtle ?? null;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function deriveSyncSecret(email: string, password: string): Promise<string> {
  const subtle = requireSubtleCrypto();
  if (!subtle) {
    return `${email.trim().toLowerCase()}:${password}`;
  }

  const encoder = new TextEncoder();
  const baseKey = await subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(email.trim().toLowerCase()),
      iterations: 120_000,
      hash: "SHA-256"
    },
    baseKey,
    256
  );

  return bytesToHex(new Uint8Array(bits));
}
