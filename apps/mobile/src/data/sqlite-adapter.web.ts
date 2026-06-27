interface SQLiteDatabaseLike {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: unknown[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
}

export async function openNativeDatabaseAsync(_name: string): Promise<SQLiteDatabaseLike> {
  throw new Error("SQLite native adapter is not available on web.");
}
