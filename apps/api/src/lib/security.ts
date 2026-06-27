import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PASSWORD_SCHEME = "scrypt";
const KEY_LENGTH = 32;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(email));
}

export function isValidPassword(password: string): boolean {
  return password.trim().length >= 8;
}

export function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(secret, salt, KEY_LENGTH).toString("hex");
  return `${PASSWORD_SCHEME}:${salt}:${hash}`;
}

export function compareSecret(secret: string, hashedSecret: string): boolean {
  if (hashedSecret.startsWith(`${PASSWORD_SCHEME}:`)) {
    const [, salt, expectedHash] = hashedSecret.split(":");
    const derivedHash = scryptSync(secret, salt, KEY_LENGTH).toString("hex");
    return safeCompareHex(derivedHash, expectedHash);
  }

  return safeCompareHex(createHash("sha256").update(secret).digest("hex"), hashedSecret);
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function safeCompareHex(leftHex: string, rightHex: string): boolean {
  const left = Buffer.from(leftHex, "hex");
  const right = Buffer.from(rightHex, "hex");

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
