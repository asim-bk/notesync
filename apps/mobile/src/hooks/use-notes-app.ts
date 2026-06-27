import { useEffect, useMemo, useState } from "react";
import type {
  CreateShareInput,
  NoteDraft,
  NoteFormat,
  NoteRecord,
  NoteSummary,
  ShareRecord
} from "@notesync/shared-types";
import { LocalNoteRepository } from "../data/local-note-repository";
import { getOrCreateDeviceSecret } from "../lib/device-key";
import { createEmptyDraft } from "../lib/note-utils";
import { decryptNoteContent, encryptNoteContent } from "../lib/web-crypto";

const repository = new LocalNoteRepository();
const OWNER_ID = "demo-user";
let seeded = false;

export type ScreenState = "list" | "editor" | "share";

interface ActiveStoredNote {
  note: NoteRecord;
  decryptedContent: string;
}

export function useNotesApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<ScreenState>("list");
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeStoredNote, setActiveStoredNote] = useState<ActiveStoredNote | undefined>();
  const [draft, setDraft] = useState<NoteDraft>(createEmptyDraft());
  const [sharePreview, setSharePreview] = useState<ShareRecord | null>(null);
  const [sharePassword, setSharePassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [deviceSecret, setDeviceSecret] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<NoteSummary[]>([]);

  useEffect(() => {
    void bootstrap();
  }, []);

  const encryptedNoteCount = useMemo(() => {
    return summaries.filter((summary) => summary.encrypted).length;
  }, [summaries]);

  function startNewNote(format: NoteFormat = "markdown") {
    setActiveNoteId(null);
    setActiveStoredNote(undefined);
    setDraft(createEmptyDraft(format));
    setSharePreview(null);
    setSharePassword("");
    setScreen("editor");
  }

  async function editNote(noteId: string) {
    await openNote(noteId);
    setSharePreview(null);
  }

  async function saveNote() {
    if (!deviceSecret) {
      return;
    }

    setLoading(true);
    try {
      const encrypted = await encryptNoteContent(draft.content, deviceSecret);
      let savedNote: NoteRecord | undefined;

      if (activeNoteId) {
        savedNote = await repository.updateDraft(activeNoteId, draft, encrypted);
      } else {
        savedNote = await repository.saveDraft(OWNER_ID, draft, encrypted);
      }

      await refreshSummaries();

      if (savedNote) {
        setActiveNoteId(savedNote.id);
        setActiveStoredNote({
          note: savedNote,
          decryptedContent: draft.content
        });
      }

      setSharePreview(null);
      setScreen("editor");
    } finally {
      setLoading(false);
    }
  }

  async function createShare() {
    if (!activeNoteId) {
      return;
    }

    const stored = activeStoredNote;
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

    await repository.recordShareHistory(stored.note.id, share);
    setSharePreview(share);
    setScreen("share");
  }

  function openSharePreview() {
    if (activeNoteId) {
      void createShare();
    }
  }

  return {
    ready,
    error,
    screen,
    draft,
    loading,
    encryptedNoteCount,
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
    createShare,
    openSharePreview
  };

  async function bootstrap() {
    setLoading(true);
    setError(null);

    try {
      await repository.initialize();
      const secret = await getOrCreateDeviceSecret();
      setDeviceSecret(secret);

      let currentSummaries = await repository.listSummaries();
      if (currentSummaries.length === 0) {
        const seedDraft = buildSeedDraft();
        const encryptedSeed = await encryptNoteContent(seedDraft.content, secret);
        const created = await repository.saveDraft(OWNER_ID, seedDraft, encryptedSeed);
        currentSummaries = await repository.listSummaries();
        await openNote(created.id, secret);
        setScreen("editor");
      } else {
        await openNote(currentSummaries[0].id, secret);
      }

      setSummaries(currentSummaries);
      setReady(true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unknown initialization error";
      setError(message);
      setReady(true);
    } finally {
      setLoading(false);
    }
  }

  async function refreshSummaries() {
    const nextSummaries = await repository.listSummaries();
    setSummaries(nextSummaries);
  }

  async function openNote(noteId: string, secretOverride?: string) {
    const secret = secretOverride ?? deviceSecret;
    if (!secret) {
      return;
    }

    const note = await repository.getById(noteId);
    if (!note) {
      return;
    }

    const decryptedContent = await decryptNoteContent(note.encryptedContent, secret);
    setActiveNoteId(note.id);
    setActiveStoredNote({
      note,
      decryptedContent
    });
    setDraft({
      title: note.title,
      content: decryptedContent,
      format: note.format
    });
    setScreen("editor");
  }
}

function buildSeedDraft(): NoteDraft {
  if (!seeded) {
    seeded = true;
  }

  return {
    title: "Offline study notes",
    content:
      "This is a sample encrypted note.\n\n- Stored locally first\n- Ready to share later",
    format: "markdown"
  };
}
