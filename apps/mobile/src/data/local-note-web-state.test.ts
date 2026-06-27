import assert from "node:assert/strict";
import test from "node:test";
import type { NoteRecord } from "@notesync/shared-types";
import {
  appendWebNoteVersion,
  createEmptyWebState,
  enqueueWebSyncState,
  migrateWebState,
  upsertWebNoteState
} from "./local-note-web-state";

const note: NoteRecord = {
  id: "note-1",
  ownerId: "user-1",
  title: "Secret note",
  format: "markdown",
  status: "active",
  syncState: "pending-sync",
  syncEnabled: true,
  encryptedContent: {
    cipherText: "cipher",
    iv: "iv",
    salt: "salt",
    algorithm: "AES-256-GCM",
    version: 1
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

test("web persistence helpers keep previews blank and queue sync work", () => {
  const initial = createEmptyWebState();
  const withNote = upsertWebNoteState(initial, note);
  const withHistory = appendWebNoteVersion(withNote, note, "2026-01-01T00:00:00.000Z");
  const withQueue = enqueueWebSyncState(
    withHistory,
    note.id,
    "upsert-note",
    JSON.stringify({ id: note.id })
  );
  const migrated = migrateWebState({
    ...withQueue,
    notes: [
      {
        ...withQueue.notes[0],
        preview: "legacy preview"
      }
    ]
  });

  assert.equal(migrated.notes[0].preview, "");
  assert.equal(migrated.notes[0].sync_enabled, 1);
  assert.equal(migrated.noteVersions.length, 1);
  assert.equal(migrated.pendingSyncQueue.length, 1);
  assert.equal(migrated.pendingSyncQueue[0].entityId, note.id);
});
