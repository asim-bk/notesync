import { createHash, timingSafeEqual } from "node:crypto";

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function compareSecret(secret: string, hashedSecret: string): boolean {
  const left = Buffer.from(hashSecret(secret));
  const right = Buffer.from(hashedSecret);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
