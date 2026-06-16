import type {
  EncryptedNoteContent,
  NoteDraft,
  NoteRecord,
  NoteSummary
} from "@notesync/shared-types";
import { createLocalId } from "../lib/id";
import { buildNoteSummary, sortNoteSummaries } from "../lib/note-utils";

interface StoredNote {
  note: NoteRecord;
  decryptedContent: string;
}

export class LocalNoteRepository {
  private readonly notes = new Map<string, StoredNote>();

  listSummaries(): NoteSummary[] {
    const summaries = [...this.notes.values()].map(({ note, decryptedContent }) =>
      buildNoteSummary(note, decryptedContent)
    );
    return sortNoteSummaries(summaries);
  }

  getById(noteId: string): StoredNote | undefined {
    return this.notes.get(noteId);
  }

  saveDraft(
    ownerId: string,
    draft: NoteDraft,
    encryptedContent: EncryptedNoteContent
  ): NoteRecord {
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

    this.notes.set(note.id, {
      note,
      decryptedContent: draft.content
    });

    return note;
  }

  updateDraft(
    noteId: string,
    draft: NoteDraft,
    encryptedContent: EncryptedNoteContent
  ): NoteRecord | undefined {
    const existing = this.notes.get(noteId);
    if (!existing) {
      return undefined;
    }

    const updated: NoteRecord = {
      ...existing.note,
      title: draft.title.trim() || "Untitled note",
      format: draft.format,
      encryptedContent,
      updatedAt: new Date().toISOString(),
      syncState: "pending-sync"
    };

    this.notes.set(noteId, {
      note: updated,
      decryptedContent: draft.content
    });

    return updated;
  }
}
