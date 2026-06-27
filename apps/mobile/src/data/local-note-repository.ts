import { Platform } from "react-native";
import type {
  EncryptedNoteContent,
  NoteDraft,
  NoteRecord,
  NoteSummary,
  ShareRecord
} from "@notesync/shared-types";
import { createLocalId } from "../lib/id";
import { buildNoteSummary, sortNoteSummaries } from "../lib/note-utils";
import { decryptNoteContent } from "../lib/web-crypto";
import {
  appendWebNoteVersion,
  createEmptyWebState,
  enqueueWebSyncState,
  migrateWebState,
  type NoteVersionEntry,
  type PendingSyncQueueItem,
  SCHEMA_VERSION,
  type SqliteNoteRow,
  upsertWebNoteState,
  type WebLocalState,
  WEB_STORAGE_KEY
} from "./local-note-web-state";
import { openNativeDatabaseAsync } from "./sqlite-adapter";

const DATABASE_NAME = "notesync.db";

interface SQLiteDatabaseLike {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: unknown[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
}

export class LocalNoteRepository {
  private initialized = false;
  private database: SQLiteDatabaseLike | null = null;
  private webState: WebLocalState = createEmptyWebState();

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (Platform.OS === "web") {
      this.webState = migrateWebState(readWebState());
      this.initialized = true;
      return;
    }

    this.database = await openNativeDatabaseAsync(DATABASE_NAME);
    await this.database.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY NOT NULL,
        owner_id TEXT NOT NULL,
        title TEXT NOT NULL,
        format TEXT NOT NULL,
        status TEXT NOT NULL,
        sync_state TEXT NOT NULL,
        sync_enabled INTEGER NOT NULL DEFAULT 0,
        preview TEXT NOT NULL DEFAULT '',
        cipher_text TEXT NOT NULL,
        iv TEXT NOT NULL,
        salt TEXT NOT NULL,
        algorithm TEXT NOT NULL,
        encryption_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS note_versions (
        id TEXT PRIMARY KEY NOT NULL,
        note_id TEXT NOT NULL,
        cipher_text TEXT NOT NULL,
        iv TEXT NOT NULL,
        salt TEXT NOT NULL,
        algorithm TEXT NOT NULL,
        encryption_version INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pending_sync_queue (
        id TEXT PRIMARY KEY NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS share_history (
        id TEXT PRIMARY KEY NOT NULL,
        note_id TEXT NOT NULL,
        share_slug TEXT NOT NULL,
        password_protected INTEGER NOT NULL,
        max_views INTEGER,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);
      CREATE INDEX IF NOT EXISTS idx_note_versions_note_id ON note_versions(note_id);
      CREATE INDEX IF NOT EXISTS idx_pending_sync_entity_id ON pending_sync_queue(entity_id);
      CREATE INDEX IF NOT EXISTS idx_share_history_note_id ON share_history(note_id);
    `);

    await ensureColumn(this.database, "notes", "sync_enabled", "INTEGER NOT NULL DEFAULT 0");
    await ensureColumn(this.database, "notes", "preview", "TEXT NOT NULL DEFAULT ''");
    await this.database.runAsync(
      `INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`,
      ["schema_version", `${SCHEMA_VERSION}`]
    );

    this.initialized = true;
  }

  async listSummaries(secret?: string): Promise<NoteSummary[]> {
    await this.initialize();
    const rows = await this.listRows();

    const summaries = await Promise.all(
      rows.map(async (row) => {
        const note = mapRowToNoteRecord(row);
        const preview = await this.decryptPreview(note, secret);
        return buildNoteSummary(note, preview);
      })
    );

    return sortNoteSummaries(summaries);
  }

  async listSyncEnabledNotes(): Promise<NoteRecord[]> {
    await this.initialize();
    const rows = await this.listRows();
    return rows
      .filter((row) => row.sync_enabled === 1)
      .map((row) => mapRowToNoteRecord(row));
  }

  async listAllNotes(): Promise<NoteRecord[]> {
    await this.initialize();
    const rows = await this.listRows();
    return rows.map((row) => mapRowToNoteRecord(row));
  }

  async getById(noteId: string): Promise<NoteRecord | undefined> {
    await this.initialize();
    const row = Platform.OS === "web"
      ? this.webState.notes.find((candidate) => candidate.id === noteId)
      : await this.getDatabase().getFirstAsync<SqliteNoteRow>(
          "SELECT * FROM notes WHERE id = ? LIMIT 1",
          [noteId]
        );

    return row ? mapRowToNoteRecord(row) : undefined;
  }

  async saveDraft(
    ownerId: string,
    draft: NoteDraft,
    encryptedContent: EncryptedNoteContent,
    options?: { syncEnabled?: boolean }
  ): Promise<NoteRecord> {
    await this.initialize();

    const now = new Date().toISOString();
    const note: NoteRecord = {
      id: createLocalId("note"),
      ownerId,
      title: draft.title.trim() || "Untitled note",
      format: draft.format,
      encryptedContent,
      status: "active",
      createdAt: now,
      updatedAt: now,
      syncState: options?.syncEnabled ? "pending-sync" : "local-only",
      syncEnabled: Boolean(options?.syncEnabled)
    };

    await this.persistNote(note);
    await this.persistVersion(note);
    if (note.syncEnabled) {
      await this.enqueueSync(note.id, "upsert-note", note);
    }

    return note;
  }

  async upsertNoteRecord(note: NoteRecord): Promise<void> {
    await this.initialize();
    await this.persistNote(note);
  }

  async updateDraft(
    noteId: string,
    draft: NoteDraft,
    encryptedContent: EncryptedNoteContent,
    options?: { syncEnabled?: boolean }
  ): Promise<NoteRecord | undefined> {
    await this.initialize();

    const existing = await this.getById(noteId);
    if (!existing) {
      return undefined;
    }

    const syncEnabled = options?.syncEnabled ?? existing.syncEnabled;
    const updated: NoteRecord = {
      ...existing,
      title: draft.title.trim() || "Untitled note",
      format: draft.format,
      encryptedContent,
      updatedAt: new Date().toISOString(),
      syncState: syncEnabled ? "pending-sync" : "local-only",
      syncEnabled
    };

    await this.persistNote(updated);
    await this.persistVersion(updated);
    if (updated.syncEnabled) {
      await this.enqueueSync(updated.id, "upsert-note", updated);
    }

    return updated;
  }

  async archive(noteId: string): Promise<NoteRecord | undefined> {
    const note = await this.getById(noteId);
    if (!note) {
      return undefined;
    }

    const archived: NoteRecord = {
      ...note,
      status: "archived",
      updatedAt: new Date().toISOString(),
      syncState: note.syncEnabled ? "pending-sync" : "local-only"
    };

    await this.persistNote(archived);
    if (archived.syncEnabled) {
      await this.enqueueSync(archived.id, "upsert-note", archived);
    }

    return archived;
  }

  async remove(noteId: string): Promise<void> {
    await this.initialize();
    const existing = await this.getById(noteId);

    if (Platform.OS === "web") {
      this.webState.notes = this.webState.notes.filter((candidate) => candidate.id !== noteId);
      this.webState.noteVersions = this.webState.noteVersions.filter(
        (candidate) => candidate.noteId !== noteId
      );
      if (existing?.syncEnabled) {
        this.webState.pendingSyncQueue.unshift({
          id: createLocalId("sync"),
          entityType: "note",
          entityId: noteId,
          operation: "delete-note",
          payloadJson: JSON.stringify({ id: noteId }),
          createdAt: new Date().toISOString()
        });
      }
      writeWebState(this.webState);
      return;
    }

    const database = this.getDatabase();
    await database.runAsync("DELETE FROM note_versions WHERE note_id = ?", [noteId]);
    await database.runAsync("DELETE FROM notes WHERE id = ?", [noteId]);

    if (existing?.syncEnabled) {
      await database.runAsync(
        `INSERT INTO pending_sync_queue (
          id, entity_type, entity_id, operation, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          createLocalId("sync"),
          "note",
          noteId,
          "delete-note",
          JSON.stringify({ id: noteId }),
          new Date().toISOString()
        ]
      );
    }
  }

  async listHistory(noteId: string): Promise<NoteVersionEntry[]> {
    await this.initialize();

    if (Platform.OS === "web") {
      return this.webState.noteVersions
        .filter((entry) => entry.noteId === noteId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    }

    return this.getDatabase().getAllAsync<NoteVersionEntry>(
      `SELECT
        id,
        note_id as noteId,
        cipher_text as cipherText,
        iv,
        salt,
        algorithm,
        encryption_version as encryptionVersion,
        created_at as createdAt
      FROM note_versions
      WHERE note_id = ?
      ORDER BY created_at DESC`,
      [noteId]
    );
  }

  async listPendingSyncQueue(): Promise<PendingSyncQueueItem[]> {
    await this.initialize();

    if (Platform.OS === "web") {
      return [...this.webState.pendingSyncQueue];
    }

    return this.getDatabase().getAllAsync<PendingSyncQueueItem>(
      `SELECT
        id,
        entity_type as entityType,
        entity_id as entityId,
        operation,
        payload_json as payloadJson,
        created_at as createdAt
      FROM pending_sync_queue
      ORDER BY created_at ASC`
    );
  }

  async dequeueSyncItem(itemId: string): Promise<void> {
    await this.initialize();

    if (Platform.OS === "web") {
      this.webState.pendingSyncQueue = this.webState.pendingSyncQueue.filter(
        (item) => item.id !== itemId
      );
      writeWebState(this.webState);
      return;
    }

    await this.getDatabase().runAsync("DELETE FROM pending_sync_queue WHERE id = ?", [itemId]);
  }

  async markNoteSynced(noteId: string): Promise<void> {
    await this.initialize();
    const note = await this.getById(noteId);
    if (!note) {
      return;
    }

    const synced: NoteRecord = {
      ...note,
      syncState: note.syncEnabled ? "synced" : "local-only"
    };

    await this.persistNote(synced);
  }

  async recordShareHistory(noteId: string, share: ShareRecord): Promise<void> {
    await this.initialize();

    if (Platform.OS === "web") {
      this.webState.shareHistory.unshift({
        id: createLocalId("share-history"),
        noteId,
        shareSlug: share.slug,
        passwordProtected: share.policy.passwordProtected,
        maxViews: share.policy.maxViews,
        createdAt: new Date().toISOString()
      });
      writeWebState(this.webState);
      return;
    }

    await this.getDatabase().runAsync(
      `INSERT INTO share_history (
        id, note_id, share_slug, password_protected, max_views, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        createLocalId("share-history"),
        noteId,
        share.slug,
        share.policy.passwordProtected ? 1 : 0,
        share.policy.maxViews ?? null,
        new Date().toISOString()
      ]
    );
  }

  private async listRows(): Promise<SqliteNoteRow[]> {
    if (Platform.OS === "web") {
      return [...this.webState.notes].sort((left, right) => right.updated_at.localeCompare(left.updated_at));
    }

    return this.getDatabase().getAllAsync<SqliteNoteRow>(
      "SELECT * FROM notes ORDER BY updated_at DESC"
    );
  }

  private async decryptPreview(note: NoteRecord, secret?: string): Promise<string> {
    if (!secret) {
      return "";
    }

    try {
      const content = await decryptNoteContent(note.encryptedContent, secret);
      return content;
    } catch {
      return "Unable to decrypt on this device.";
    }
  }

  private async persistNote(note: NoteRecord): Promise<void> {
    if (Platform.OS === "web") {
      this.webState = upsertWebNoteState(this.webState, note);
      writeWebState(this.webState);
      return;
    }

    await this.getDatabase().runAsync(
      `INSERT OR REPLACE INTO notes (
        id, owner_id, title, format, status, sync_state, sync_enabled, preview,
        cipher_text, iv, salt, algorithm, encryption_version,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        note.id,
        note.ownerId,
        note.title,
        note.format,
        note.status,
        note.syncState,
        note.syncEnabled ? 1 : 0,
        "",
        note.encryptedContent.cipherText,
        note.encryptedContent.iv,
        note.encryptedContent.salt,
        note.encryptedContent.algorithm,
        note.encryptedContent.version,
        note.createdAt,
        note.updatedAt
      ]
    );
  }

  private async persistVersion(note: NoteRecord): Promise<void> {
    if (Platform.OS === "web") {
      this.webState = appendWebNoteVersion(this.webState, note);
      writeWebState(this.webState);
      return;
    }

    await this.getDatabase().runAsync(
      `INSERT INTO note_versions (
        id, note_id, cipher_text, iv, salt, algorithm, encryption_version, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        createLocalId("note-version"),
        note.id,
        note.encryptedContent.cipherText,
        note.encryptedContent.iv,
        note.encryptedContent.salt,
        note.encryptedContent.algorithm,
        note.encryptedContent.version,
        new Date().toISOString()
      ]
    );
  }

  private async enqueueSync(
    entityId: string,
    operation: "upsert-note" | "delete-note",
    payload: NoteRecord
  ): Promise<void> {
    const payloadJson = JSON.stringify({
      id: payload.id,
      title: payload.title,
      format: payload.format,
      updatedAt: payload.updatedAt,
      status: payload.status
    });

    if (Platform.OS === "web") {
      this.webState = enqueueWebSyncState(this.webState, entityId, operation, payloadJson);
      writeWebState(this.webState);
      return;
    }

    await this.getDatabase().runAsync(
      `INSERT INTO pending_sync_queue (
        id, entity_type, entity_id, operation, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        createLocalId("sync"),
        "note",
        entityId,
        operation,
        payloadJson,
        new Date().toISOString()
      ]
    );
  }

  private getDatabase(): SQLiteDatabaseLike {
    if (!this.database) {
      throw new Error("Local SQLite database has not been initialized.");
    }

    return this.database;
  }
}

function mapRowToNoteRecord(row: SqliteNoteRow): NoteRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    format: row.format,
    status: row.status,
    syncState: row.sync_state,
    syncEnabled: row.sync_enabled === 1,
    encryptedContent: {
      cipherText: row.cipher_text,
      iv: row.iv,
      salt: row.salt,
      algorithm: row.algorithm,
      version: row.encryption_version
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function readWebState(): WebLocalState {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return createEmptyWebState();
    }

    const stored = window.localStorage.getItem(WEB_STORAGE_KEY);
    return stored ? migrateWebState(JSON.parse(stored) as Partial<WebLocalState>) : createEmptyWebState();
  } catch {
    return createEmptyWebState();
  }
}

function writeWebState(state: WebLocalState): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    window.localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Web persistence remains best-effort.
  }
}

async function ensureColumn(
  database: SQLiteDatabaseLike,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  try {
    await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  } catch {
    // Column already exists or database is locked during a previous migration attempt.
  }
}
