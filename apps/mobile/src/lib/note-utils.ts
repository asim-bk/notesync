import type {
  EncryptedNoteContent,
  NoteDraft,
  NoteFormat,
  NoteRecord,
  NoteSummary
} from "@notesync/shared-types";

export function createEmptyDraft(format: NoteFormat = "markdown"): NoteDraft {
  return {
    title: "",
    content: "",
    format
  };
}

export function buildNoteSummary(note: NoteRecord, decryptedContent: string): NoteSummary {
  return {
    id: note.id,
    title: note.title.trim() || "Untitled note",
    excerpt: decryptedContent.replace(/\s+/g, " ").trim().slice(0, 96),
    format: note.format,
    updatedAt: note.updatedAt,
    syncState: note.syncState,
    syncEnabled: note.syncEnabled,
    encrypted: true
  };
}

export function sortNoteSummaries(notes: NoteSummary[]): NoteSummary[] {
  return [...notes].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

export function buildEncryptedSeed(): EncryptedNoteContent {
  return {
    cipherText: "seed",
    iv: "seed",
    salt: "seed",
    algorithm: "AES-256-GCM",
    version: 1
  };
}
