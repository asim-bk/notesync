import "dotenv/config";

const storeProvider = process.env.STORE_PROVIDER === "prisma" ? "prisma" : "memory";

if (storeProvider === "prisma" && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set when STORE_PROVIDER=prisma.");
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? "0.0.0.0",
  jwtSecret: process.env.JWT_SECRET ?? "notesync-dev-secret",
  accessTokenTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900),
  refreshTokenTtlSeconds: Number(process.env.REFRESH_TOKEN_TTL_SECONDS ?? 604800),
  storeProvider,
  databaseUrl: process.env.DATABASE_URL ?? null
};
