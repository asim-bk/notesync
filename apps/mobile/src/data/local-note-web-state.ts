import type { EncryptedNoteContent, NoteRecord } from "@notesync/shared-types";
import { createLocalId } from "../lib/id";

export const WEB_STORAGE_KEY = "notesync.local-state.v2";
export const SCHEMA_VERSION = 2;

export interface SqliteNoteRow {
  id: string;
  owner_id: string;
  title: string;
  format: NoteRecord["format"];
  status: NoteRecord["status"];
  sync_state: NoteRecord["syncState"];
  sync_enabled: number;
  preview: string;
  cipher_text: string;
  iv: string;
  salt: string;
  algorithm: EncryptedNoteContent["algorithm"];
  encryption_version: number;
  created_at: string;
  updated_at: string;
}

export interface NoteVersionEntry {
  id: string;
  noteId: string;
  cipherText: string;
  iv: string;
  salt: string;
  algorithm: string;
  encryptionVersion: number;
  createdAt: string;
}

export interface PendingSyncQueueItem {
  id: string;
  entityType: string;
  entityId: string;
  operation: string;
  payloadJson: string;
  createdAt: string;
}

export interface ShareHistoryEntry {
  id: string;
  noteId: string;
  shareSlug: string;
  passwordProtected: boolean;
  maxViews?: number;
  createdAt: string;
}

export interface WebLocalState {
  schemaVersion: number;
  notes: SqliteNoteRow[];
  noteVersions: NoteVersionEntry[];
  pendingSyncQueue: PendingSyncQueueItem[];
  shareHistory: ShareHistoryEntry[];
}

export function createEmptyWebState(): WebLocalState {
  return {
    schemaVersion: SCHEMA_VERSION,
    notes: [],
    noteVersions: [],
    pendingSyncQueue: [],
    shareHistory: []
  };
}

export function migrateWebState(state: Partial<WebLocalState>): WebLocalState {
  return {
    schemaVersion: SCHEMA_VERSION,
    notes: (state.notes ?? []).map((row) => ({
      ...row,
      preview: "",
      sync_enabled: row.sync_enabled ?? 0
    })),
    noteVersions: state.noteVersions ?? [],
    pendingSyncQueue: state.pendingSyncQueue ?? [],
    shareHistory: state.shareHistory ?? []
  };
}

export function mapNoteRecordToRow(note: NoteRecord): SqliteNoteRow {
  return {
    id: note.id,
    owner_id: note.ownerId,
    title: note.title,
    format: note.format,
    status: note.status,
    sync_state: note.syncState,
    sync_enabled: note.syncEnabled ? 1 : 0,
    preview: "",
    cipher_text: note.encryptedContent.cipherText,
    iv: note.encryptedContent.iv,
    salt: note.encryptedContent.salt,
    algorithm: note.encryptedContent.algorithm,
    encryption_version: note.encryptedContent.version,
    created_at: note.createdAt,
    updated_at: note.updatedAt
  };
}

export function upsertWebNoteState(state: WebLocalState, note: NoteRecord): WebLocalState {
  const row = mapNoteRecordToRow(note);
  const index = state.notes.findIndex((candidate) => candidate.id === note.id);
  const nextNotes = [...state.notes];

  if (index >= 0) {
    nextNotes[index] = row;
  } else {
    nextNotes.unshift(row);
  }

  return {
    ...state,
    notes: nextNotes
  };
}

export function appendWebNoteVersion(
  state: WebLocalState,
  note: NoteRecord,
  createdAt = new Date().toISOString()
): WebLocalState {
  return {
    ...state,
    noteVersions: [
      {
        id: createLocalId("note-version"),
        noteId: note.id,
        cipherText: note.encryptedContent.cipherText,
        iv: note.encryptedContent.iv,
        salt: note.encryptedContent.salt,
        algorithm: note.encryptedContent.algorithm,
        encryptionVersion: note.encryptedContent.version,
        createdAt
      },
      ...state.noteVersions
    ]
  };
}

export function enqueueWebSyncState(
  state: WebLocalState,
  entityId: string,
  operation: "delete-note" | "upsert-note",
  payloadJson: string,
  createdAt = new Date().toISOString()
): WebLocalState {
  return {
    ...state,
    pendingSyncQueue: [
      {
        id: createLocalId("sync"),
        entityType: "note",
        entityId,
        operation,
        payloadJson,
        createdAt
      },
      ...state.pendingSyncQueue
    ]
  };
}
