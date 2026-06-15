import { randomUUID } from "node:crypto";

export function createId(): string {
  return randomUUID();
}

export function createSlug(): string {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}
