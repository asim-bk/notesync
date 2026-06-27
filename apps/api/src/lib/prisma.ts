import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __notesyncPrisma: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient {
  if (!globalThis.__notesyncPrisma) {
    globalThis.__notesyncPrisma = new PrismaClient();
  }

  return globalThis.__notesyncPrisma;
}
