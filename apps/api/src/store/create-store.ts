import { config } from "../config";
import { MemoryStore } from "./memory-store";
import { PrismaStore } from "./prisma-store";
import type { AppStore } from "./store";

export function createAppStore(): AppStore {
  if (config.storeProvider === "prisma") {
    return new PrismaStore();
  }

  return new MemoryStore();
}
