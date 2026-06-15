import type {
  CreateNoteInput,
  NoteDraft,
  NoteFormat,
  NoteRecord,
  NoteSummary,
  SharePolicy,
  SyncState,
  UpdateNoteInput
} from "@notesync/shared-types";

function createExcerpt(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, 96);
}

function normalizeTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : "Untitled note";
}

export function createEmptyDraft(format: NoteFormat = "markdown"): NoteDraft {
  return {
    title: "",
    content: "",
    format
  };
}

export function buildCreateNoteInput(
  encryptedContent: CreateNoteInput["encryptedContent"],
  draft: NoteDraft
): CreateNoteInput {
  return {
    title: normalizeTitle(draft.title),
    format: draft.format,
    encryptedContent
  };
}

export function applyNoteUpdate(
  note: NoteRecord,
  input: UpdateNoteInput
): NoteRecord {
  return {
    ...note,
    title: input.title ? normalizeTitle(input.title) : note.title,
    format: input.format ?? note.format,
    encryptedContent: input.encryptedContent ?? note.encryptedContent,
    status: input.status ?? note.status,
    updatedAt: new Date().toISOString(),
    syncState: nextSyncState(note.syncState)
  };
}

function nextSyncState(current: SyncState): SyncState {
  if (current === "local-only") {
    return "local-only";
  }

  return "pending-sync";
}

export function toNoteSummary(
  note: NoteRecord,
  decryptedContent: string
): NoteSummary {
  return {
    id: note.id,
    title: normalizeTitle(note.title),
    excerpt: createExcerpt(decryptedContent),
    format: note.format,
    updatedAt: note.updatedAt,
    syncState: note.syncState,
    encrypted: true
  };
}

export function canAccessShare(
  policy: SharePolicy,
  currentViews: number,
  now: Date = new Date()
): { allowed: boolean; reason?: string } {
  if (policy.expiresAt && new Date(policy.expiresAt).getTime() <= now.getTime()) {
    return { allowed: false, reason: "share-expired" };
  }

  if (typeof policy.maxViews === "number" && currentViews >= policy.maxViews) {
    return { allowed: false, reason: "share-view-limit-reached" };
  }

  return { allowed: true };
}

export function sortNotesByUpdatedAt(notes: NoteSummary[]): NoteSummary[] {
  return [...notes].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}
