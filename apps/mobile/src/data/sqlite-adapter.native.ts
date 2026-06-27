interface SQLiteDatabaseLike {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: unknown[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
}

export async function openNativeDatabaseAsync(name: string): Promise<SQLiteDatabaseLike> {
  const sqlite = require("expo-sqlite") as {
    openDatabaseAsync(databaseName: string): Promise<SQLiteDatabaseLike>;
  };

  return sqlite.openDatabaseAsync(name);
}
