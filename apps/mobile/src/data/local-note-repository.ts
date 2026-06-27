import * as SQLite from "expo-sqlite";
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

const DATABASE_NAME = "notesync.db";
const WEB_STORAGE_KEY = "notesync.local-state.v1";

interface SqliteNoteRow {
  id: string;
  owner_id: string;
  title: string;
  format: NoteRecord["format"];
  status: NoteRecord["status"];
  sync_state: NoteRecord["syncState"];
  preview: string;
  cipher_text: string;
  iv: string;
  salt: string;
  algorithm: EncryptedNoteContent["algorithm"];
  encryption_version: number;
  created_at: string;
  updated_at: string;
}

interface WebLocalState {
  notes: SqliteNoteRow[];
  noteVersions: Array<{
    id: string;
    noteId: string;
    cipherText: string;
    iv: string;
    salt: string;
    algorithm: string;
    encryptionVersion: number;
    createdAt: string;
  }>;
  pendingSyncQueue: Array<{
    id: string;
    entityType: string;
    entityId: string;
    operation: string;
    payloadJson: string;
    createdAt: string;
  }>;
  shareHistory: Array<{
    id: string;
    noteId: string;
    shareSlug: string;
    passwordProtected: boolean;
    maxViews?: number;
    createdAt: string;
  }>;
}

function createEmptyWebState(): WebLocalState {
  return {
    notes: [],
    noteVersions: [],
    pendingSyncQueue: [],
    shareHistory: []
  };
}

export class LocalNoteRepository {
  private initialized = false;
  private database: SQLite.SQLiteDatabase | null = null;
  private webState: WebLocalState = createEmptyWebState();

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (Platform.OS === "web") {
      this.webState = readWebState();
      this.initialized = true;
      return;
    }

    this.database = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await this.database.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY NOT NULL,
        owner_id TEXT NOT NULL,
        title TEXT NOT NULL,
        format TEXT NOT NULL,
        status TEXT NOT NULL,
        sync_state TEXT NOT NULL,
        preview TEXT NOT NULL,
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

    this.initialized = true;
  }

  async listSummaries(): Promise<NoteSummary[]> {
    await this.initialize();
    const rows = Platform.OS === "web"
      ? this.webState.notes
      : await this.getDatabase().getAllAsync<SqliteNoteRow>(
          "SELECT * FROM notes ORDER BY updated_at DESC"
        );

    const summaries = rows.map((row) => buildNoteSummary(mapRowToNoteRecord(row), row.preview));
    return sortNoteSummaries(summaries);
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
    encryptedContent: EncryptedNoteContent
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
      syncState: "local-only"
    };

    const preview = buildPreview(draft.content);
    await this.persistNote(note, preview);
    await this.persistVersion(note);
    await this.enqueueSync(note.id, "create-note", note);

    return note;
  }

  async updateDraft(
    noteId: string,
    draft: NoteDraft,
    encryptedContent: EncryptedNoteContent
  ): Promise<NoteRecord | undefined> {
    await this.initialize();

    const existing = await this.getById(noteId);
    if (!existing) {
      return undefined;
    }

    const updated: NoteRecord = {
      ...existing,
      title: draft.title.trim() || "Untitled note",
      format: draft.format,
      encryptedContent,
      updatedAt: new Date().toISOString(),
      syncState: "pending-sync"
    };

    const preview = buildPreview(draft.content);
    await this.persistNote(updated, preview);
    await this.persistVersion(updated);
    await this.enqueueSync(updated.id, "update-note", updated);

    return updated;
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

  private async persistNote(note: NoteRecord, preview: string): Promise<void> {
    if (Platform.OS === "web") {
      const row = mapNoteRecordToRow(note, preview);
      const index = this.webState.notes.findIndex((candidate) => candidate.id === note.id);
      if (index >= 0) {
        this.webState.notes[index] = row;
      } else {
        this.webState.notes.unshift(row);
      }
      writeWebState(this.webState);
      return;
    }

    await this.getDatabase().runAsync(
      `INSERT OR REPLACE INTO notes (
        id, owner_id, title, format, status, sync_state, preview,
        cipher_text, iv, salt, algorithm, encryption_version,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        note.id,
        note.ownerId,
        note.title,
        note.format,
        note.status,
        note.syncState,
        preview,
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
      this.webState.noteVersions.unshift({
        id: createLocalId("note-version"),
        noteId: note.id,
        cipherText: note.encryptedContent.cipherText,
        iv: note.encryptedContent.iv,
        salt: note.encryptedContent.salt,
        algorithm: note.encryptedContent.algorithm,
        encryptionVersion: note.encryptedContent.version,
        createdAt: new Date().toISOString()
      });
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
    operation: "create-note" | "update-note",
    payload: NoteRecord
  ): Promise<void> {
    const payloadJson = JSON.stringify({
      id: payload.id,
      title: payload.title,
      format: payload.format,
      updatedAt: payload.updatedAt
    });

    if (Platform.OS === "web") {
      this.webState.pendingSyncQueue.unshift({
        id: createLocalId("sync"),
        entityType: "note",
        entityId,
        operation,
        payloadJson,
        createdAt: new Date().toISOString()
      });
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

  private getDatabase(): SQLite.SQLiteDatabase {
    if (!this.database) {
      throw new Error("Local SQLite database has not been initialized.");
    }

    return this.database;
  }
}

function mapNoteRecordToRow(note: NoteRecord, preview: string): SqliteNoteRow {
  return {
    id: note.id,
    owner_id: note.ownerId,
    title: note.title,
    format: note.format,
    status: note.status,
    sync_state: note.syncState,
    preview,
    cipher_text: note.encryptedContent.cipherText,
    iv: note.encryptedContent.iv,
    salt: note.encryptedContent.salt,
    algorithm: note.encryptedContent.algorithm,
    encryption_version: note.encryptedContent.version,
    created_at: note.createdAt,
    updated_at: note.updatedAt
  };
}

function mapRowToNoteRecord(row: SqliteNoteRow): NoteRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    format: row.format,
    status: row.status,
    syncState: row.sync_state,
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

function buildPreview(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, 180);
}

function readWebState(): WebLocalState {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return createEmptyWebState();
    }

    const stored = window.localStorage.getItem(WEB_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as WebLocalState) : createEmptyWebState();
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
