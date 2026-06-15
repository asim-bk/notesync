import { useState } from "react";
import type {
  CreateShareInput,
  NoteDraft,
  NoteFormat,
  NoteSummary,
  ShareRecord
} from "@notesync/shared-types";
import { createEmptyDraft } from "@notesync/note-domain";
import { encryptNoteContent } from "@notesync/crypto-core";
import { LocalNoteRepository } from "../data/local-note-repository";

const repository = new LocalNoteRepository();
const DEVICE_SECRET = "local-demo-device-secret";
const OWNER_ID = "demo-user";
let seeded = false;

export type ScreenState = "list" | "editor" | "share";

export function useNotesApp() {
  const [screen, setScreen] = useState<ScreenState>("list");
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NoteDraft>(() => seedInitialDraft());
  const [sharePreview, setSharePreview] = useState<ShareRecord | null>(null);
  const [sharePassword, setSharePassword] = useState("");
  const [loading, setLoading] = useState(false);

  const summaries: NoteSummary[] = repository.listSummaries();
  const activeStoredNote = activeNoteId ? repository.getById(activeNoteId) : undefined;

  function startNewNote(format: NoteFormat = "markdown") {
    setActiveNoteId(null);
    setDraft(createEmptyDraft(format));
    setScreen("editor");
  }

  function editNote(noteId: string) {
    const stored = repository.getById(noteId);
    if (!stored) {
      return;
    }

    setActiveNoteId(noteId);
    setDraft({
      title: stored.note.title,
      content: stored.decryptedContent,
      format: stored.note.format
    });
    setScreen("editor");
  }

  async function saveNote() {
    setLoading(true);
    try {
      const encrypted = await encryptNoteContent(draft.content, DEVICE_SECRET);
      if (activeNoteId) {
        repository.updateDraft(activeNoteId, draft, encrypted);
      } else {
        const created = repository.saveDraft(OWNER_ID, draft, encrypted);
        setActiveNoteId(created.id);
      }
      setScreen("list");
    } finally {
      setLoading(false);
    }
  }

  async function createShare() {
    if (!activeNoteId) {
      return;
    }

    const stored = repository.getById(activeNoteId);
    if (!stored) {
      return;
    }

    const share: ShareRecord = {
      id: `share-${stored.note.id}`,
      noteId: stored.note.id,
      slug: stored.note.id.slice(-8),
      createdBy: stored.note.ownerId,
      encryptedContent: stored.note.encryptedContent,
      title: stored.note.title,
      format: stored.note.format,
      policy: {
        passwordProtected: Boolean(sharePassword),
        expiresAt: undefined,
        maxViews: 25
      },
      createdAt: new Date().toISOString(),
      accessCount: 0
    };

    const _sharePayload: CreateShareInput = {
      noteId: stored.note.id,
      title: stored.note.title,
      format: stored.note.format,
      encryptedContent: stored.note.encryptedContent,
      password: sharePassword || undefined,
      maxViews: 25
    };

    setSharePreview(share);
    setScreen("share");
  }

  return {
    screen,
    draft,
    loading,
    summaries,
    activeStoredNote,
    sharePreview,
    sharePassword,
    setDraft,
    setScreen,
    setSharePassword,
    startNewNote,
    editNote,
    saveNote,
    createShare
  };
}

function seedInitialDraft(): NoteDraft {
  if (!seeded) {
    seeded = true;
    repository.saveDraft(
      OWNER_ID,
      {
        title: "Offline study notes",
        content:
          "This is a sample encrypted note.\n\n- Stored locally first\n- Ready to share later",
        format: "markdown"
      },
      {
        cipherText: "seed",
        iv: "seed",
        salt: "seed",
        algorithm: "AES-256-GCM",
        version: 1
      }
    );
  }

  return createEmptyDraft();
}
