import { useEffect, useMemo, useState } from "react";
import type {
  LoginInput,
  NoteDraft,
  NoteFormat,
  NoteRecord,
  NoteSummary,
  RegisterInput,
  ShareCreationResult
} from "@notesync/shared-types";
import { convertNoteContent } from "@notesync/note-domain";
import { LocalNoteRepository } from "../data/local-note-repository";
import type { ShareHistoryEntry } from "../data/local-note-web-state";
import {
  accessRemoteShare,
  ApiClientError,
  createRemoteNote,
  createRemoteShare,
  deleteRemoteNote,
  fetchCurrentUser,
  listRemoteNotes,
  login,
  logout,
  refreshAuthSession,
  register,
  updateRemoteNote
} from "../lib/api-client";
import { API_BASE_URL } from "../lib/app-config";
import {
  clearStoredAuthState,
  readStoredAuthState,
  type StoredAuthState,
  writeStoredAuthState
} from "../lib/auth-storage";
import { getOrCreateDeviceSecret, rotateStoredDeviceSecret } from "../lib/device-key";
import { exportNoteDocument, type ExportTarget } from "../lib/exporters";
import { createEmptyDraft } from "../lib/note-utils";
import { deriveSyncSecret } from "../lib/sync-secret";
import { decryptNoteContent, encryptNoteContent } from "../lib/web-crypto";

const repository = new LocalNoteRepository();
const OWNER_ID = "demo-user";
let seeded = false;

export type ScreenState = "list" | "editor" | "share";
export type AuthMode = "register" | "login";

interface ActiveStoredNote {
  note: NoteRecord;
  decryptedContent: string;
}

interface AccessedShareState {
  slug: string;
  title: string;
  format: NoteFormat;
  createdAt: string;
  content: string;
}

interface AuthFormState {
  email: string;
  password: string;
  displayName: string;
}

interface ShareHistoryItem {
  id: string;
  noteId: string;
  noteTitle: string;
  shareSlug: string;
  shareUrl: string;
  passwordProtected: boolean;
  maxViews?: number;
  createdAt: string;
}

export function useNotesApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [screen, setScreen] = useState<ScreenState>("list");
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeStoredNote, setActiveStoredNote] = useState<ActiveStoredNote | undefined>();
  const [draft, setDraft] = useState<NoteDraft>(createEmptyDraft());
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [sharePreview, setSharePreview] = useState<ShareCreationResult | null>(null);
  const [sharePassword, setSharePassword] = useState("");
  const [shareSlug, setShareSlug] = useState("");
  const [shareAccessPassword, setShareAccessPassword] = useState("");
  const [accessedShare, setAccessedShare] = useState<AccessedShareState | null>(null);
  const [loading, setLoading] = useState(false);
  const [deviceSecret, setDeviceSecret] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<NoteSummary[]>([]);
  const [shareHistory, setShareHistory] = useState<ShareHistoryItem[]>([]);
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [authForm, setAuthForm] = useState<AuthFormState>({
    email: "demo@notesync.local",
    password: "DemoPass123!",
    displayName: "Demo User"
  });
  const [authState, setAuthState] = useState<StoredAuthState | null>(null);

  useEffect(() => {
    void bootstrap();
  }, []);

  const encryptedNoteCount = useMemo(() => {
    return summaries.filter((summary) => summary.encrypted).length;
  }, [summaries]);

  const syncedNoteCount = useMemo(() => {
    return summaries.filter((summary) => summary.syncState === "synced").length;
  }, [summaries]);

  function startNewNote(format: NoteFormat = "markdown") {
    setActiveNoteId(null);
    setActiveStoredNote(undefined);
    setDraft(createEmptyDraft(format));
    setSyncEnabled(Boolean(authState));
    setSharePreview(null);
    setSharePassword("");
    setStatusMessage(null);
    setScreen("editor");
  }

  async function editNote(noteId: string) {
    await openNote(noteId);
    setSharePreview(null);
    setAccessedShare(null);
    setStatusMessage(null);
  }

  async function saveNote() {
    if (!deviceSecret) {
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    try {
      const encrypted = await encryptNoteContent(draft.content, deviceSecret);
      let savedNote: NoteRecord | undefined;

      if (activeNoteId) {
        savedNote = await repository.updateDraft(activeNoteId, draft, encrypted, { syncEnabled });
      } else {
        savedNote = await repository.saveDraft(OWNER_ID, draft, encrypted, { syncEnabled });
      }

      if (!savedNote) {
        return;
      }

      if (savedNote.syncEnabled && authState) {
        const nextAuthState = await ensureFreshAuthState();
        if (nextAuthState) {
          await pushNoteToRemote(savedNote, draft.content, nextAuthState);
          await repository.markNoteSynced(savedNote.id);
          savedNote = {
            ...savedNote,
            syncState: "synced"
          };
        }
      }

      await refreshSummaries(deviceSecret);
      await refreshShareHistory();

      setActiveNoteId(savedNote.id);
      setActiveStoredNote({
        note: savedNote,
        decryptedContent: draft.content
      });

      setSharePreview(null);
      setScreen("editor");
      setStatusMessage(savedNote.syncEnabled ? "Note saved and synced." : "Encrypted note saved locally.");
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  async function createShare() {
    if (!activeStoredNote) {
      setStatusMessage("Open a note before creating a share.");
      return null;
    }

    return createShareForNote(activeStoredNote.note.id, sharePassword);
  }

  async function accessSharedNote() {
    if (!shareSlug.trim()) {
      setStatusMessage("Share slug is required.");
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const trimmedPassword = shareAccessPassword.trim();
      const response = await accessRemoteShare(shareSlug.trim(), trimmedPassword || undefined);
      const content = await decryptNoteContent(response.encryptedContent, trimmedPassword);
      setAccessedShare({
        slug: response.share.slug,
        title: response.share.title,
        format: response.share.format,
        createdAt: response.share.createdAt,
        content
      });
      setScreen("share");
      setStatusMessage("Shared note opened.");
    } catch (cause) {
      setAccessedShare(null);
      setStatusMessage(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  async function syncNow() {
    if (!deviceSecret) {
      return false;
    }

    const nextAuthState = await ensureFreshAuthState();
    if (!nextAuthState) {
      setStatusMessage("Sign in before running sync.");
      return false;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const queue = await repository.listPendingSyncQueue();
      for (const item of queue) {
        if (item.entityType !== "note") {
          await repository.dequeueSyncItem(item.id);
          continue;
        }

        if (item.operation === "delete-note") {
          try {
            await deleteRemoteNote(nextAuthState.session.tokens.accessToken, item.entityId);
          } catch (cause) {
            if (!(cause instanceof ApiClientError) || cause.status !== 404) {
              throw cause;
            }
          }
          await repository.dequeueSyncItem(item.id);
          continue;
        }

        const localNote = await repository.getById(item.entityId);
        if (!localNote) {
          await repository.dequeueSyncItem(item.id);
          continue;
        }

        const localContent = await decryptNoteContent(localNote.encryptedContent, deviceSecret);
        await pushNoteToRemote(localNote, localContent, nextAuthState);
        await repository.markNoteSynced(localNote.id);
        await repository.dequeueSyncItem(item.id);
      }

      const remoteNotes = await listRemoteNotes(nextAuthState.session.tokens.accessToken);
      let conflictCount = 0;

      for (const remoteNote of remoteNotes) {
        const localNote = await repository.getById(remoteNote.id);
        if (
          localNote &&
          localNote.syncState === "pending-sync" &&
          new Date(remoteNote.updatedAt).getTime() > new Date(localNote.updatedAt).getTime()
        ) {
          conflictCount += 1;
          continue;
        }

        const content = await decryptNoteContent(remoteNote.encryptedContent, nextAuthState.syncSecret);
        const localEncryptedContent = await encryptNoteContent(content, deviceSecret);
        await repository.upsertNoteRecord({
          ...remoteNote,
          encryptedContent: localEncryptedContent,
          syncEnabled: true,
          syncState: "synced"
        });
      }

      await refreshSummaries(deviceSecret);
      await refreshShareHistory();
      if (activeNoteId) {
        await openNote(activeNoteId, deviceSecret);
      }

      setStatusMessage(
        conflictCount > 0
          ? `Sync finished with ${conflictCount} deferred conflict(s).`
          : "Sync completed successfully."
      );
      return true;
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause));
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function exportActiveNote(target: ExportTarget) {
    const content = activeStoredNote?.decryptedContent ?? draft.content;
    const title = draft.title || activeStoredNote?.note.title || "NoteSync note";
    if (!content.trim()) {
      setStatusMessage("There is no note content to export.");
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    try {
      const filename = await exportNoteDocument(
        {
          title,
          content,
          format: draft.format
        },
        target
      );
      setStatusMessage(`${filename} exported.`);
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  async function rotateDeviceKey() {
    if (!deviceSecret) {
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const notes = await repository.listAllNotes();
      const nextSecret = await rotateStoredDeviceSecret();

      for (const note of notes) {
        const content = await decryptNoteContent(note.encryptedContent, deviceSecret);
        const reencryptedContent = await encryptNoteContent(content, nextSecret);
        await repository.upsertNoteRecord({
          ...note,
          encryptedContent: reencryptedContent
        });
      }

      setDeviceSecret(nextSecret);
      await refreshSummaries(nextSecret);
      if (activeNoteId) {
        await openNote(activeNoteId, nextSecret);
      }
      setStatusMessage("Device encryption key rotated successfully.");
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  async function submitAuth() {
    setLoading(true);
    setStatusMessage(null);

    try {
      const email = authForm.email.trim().toLowerCase();
      const password = authForm.password;
      const syncSecret = await deriveSyncSecret(email, password);
      const payload: RegisterInput | LoginInput = authMode === "register"
        ? {
            email,
            password,
            displayName: authForm.displayName.trim() || "NoteSync User"
          }
        : {
            email,
            password
          };

      const session = authMode === "register"
        ? await register(payload as RegisterInput)
        : await login(payload as LoginInput);

      const nextAuthState: StoredAuthState = { session, syncSecret };
      await writeStoredAuthState(nextAuthState);
      setAuthState(nextAuthState);
      setSyncEnabled(true);
      await refreshShareHistory();
      setStatusMessage(authMode === "register" ? "Account created." : "Signed in.");
      return true;
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause));
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    const current = authState;
    setLoading(true);
    try {
      if (current) {
        await logout(current.session.tokens.refreshToken);
      }
    } catch {
      // best-effort logout
    } finally {
      await clearStoredAuthState();
      setAuthState(null);
      setSyncEnabled(false);
      await refreshShareHistory();
      setLoading(false);
      setStatusMessage("Signed out.");
    }
  }

  async function deleteNote(noteId?: string) {
    const targetNoteId = noteId ?? activeNoteId;
    const secret = deviceSecret;
    if (!targetNoteId || !secret) {
      setStatusMessage("Open a note before deleting it.");
      return false;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      await repository.remove(targetNoteId);
      const nextSummaries = await repository.listSummaries(secret);
      setSummaries(nextSummaries);
      await refreshShareHistory();

      if (nextSummaries.length > 0) {
        await openNote(nextSummaries[0].id, secret, "list");
      } else {
        setActiveNoteId(null);
        setActiveStoredNote(undefined);
        setDraft(createEmptyDraft());
        setSyncEnabled(Boolean(authState));
        setScreen("list");
      }

      setSharePreview(null);
      setStatusMessage("Note deleted.");
      return true;
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause));
      return false;
    } finally {
      setLoading(false);
    }
  }

  function changeFormat(nextFormat: NoteFormat) {
    setDraft((current) => {
      if (current.format === nextFormat) {
        return current;
      }

      return {
        ...current,
        format: nextFormat,
        content: convertNoteContent(current.content, current.format, nextFormat)
      };
    });
  }

  function openSharePreview() {
    void createShare();
  }

  return {
    ready,
    error,
    statusMessage,
    screen,
    draft,
    loading,
    encryptedNoteCount,
    syncedNoteCount,
    summaries,
    shareHistory,
    activeStoredNote,
    sharePreview,
    sharePassword,
    shareSlug,
    shareAccessPassword,
    accessedShare,
    authState,
    authMode,
    authForm,
    syncEnabled,
    setDraft,
    setScreen,
    setSharePassword,
    setShareSlug,
    setShareAccessPassword,
    setAuthMode,
    setAuthForm,
    setSyncEnabled,
    startNewNote,
    editNote,
    saveNote,
    createShare,
    createShareForNote,
    openSharePreview,
    accessSharedNote,
    syncNow,
    exportActiveNote,
    rotateDeviceKey,
    deleteNote,
    submitAuth,
    signOut,
    changeFormat
  };

  async function bootstrap() {
    setLoading(true);
    setError(null);

    try {
      await repository.initialize();
      const secret = await getOrCreateDeviceSecret();
      setDeviceSecret(secret);

      const restoredAuth = await restoreAuthState();
      if (restoredAuth) {
        setAuthState(restoredAuth);
      }

      let currentSummaries = await repository.listSummaries(secret);
      if (currentSummaries.length === 0) {
        const seedDraft = buildSeedDraft();
        const encryptedSeed = await encryptNoteContent(seedDraft.content, secret);
        const created = await repository.saveDraft(OWNER_ID, seedDraft, encryptedSeed, {
          syncEnabled: false
        });
        currentSummaries = await repository.listSummaries(secret);
        await openNote(created.id, secret, "list");
      } else {
        await openNote(currentSummaries[0].id, secret, "list");
      }

      setSummaries(currentSummaries);
      await refreshShareHistory();
      setReady(true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unknown initialization error";
      setError(message);
      setReady(true);
    } finally {
      setLoading(false);
    }
  }

  async function refreshSummaries(secretOverride?: string) {
    const nextSummaries = await repository.listSummaries(secretOverride ?? deviceSecret ?? undefined);
    setSummaries(nextSummaries);
  }

  async function refreshShareHistory() {
    const [entries, notes] = await Promise.all([
      repository.listShareHistory(),
      repository.listAllNotes()
    ]);

    const noteMap = new Map(notes.map((note) => [note.id, note]));
    setShareHistory(entries.map((entry) => mapShareHistoryItem(entry, noteMap.get(entry.noteId))));
  }

  async function openNote(
    noteId: string,
    secretOverride?: string,
    nextScreen: ScreenState = "editor"
  ) {
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
    setSyncEnabled(note.syncEnabled);
    setDraft({
      title: note.title,
      content: decryptedContent,
      format: note.format
    });
    setScreen(nextScreen);
  }

  async function createShareForNote(noteId: string, password?: string) {
    const nextAuthState = await ensureFreshAuthState();
    if (!nextAuthState) {
      setStatusMessage("Sign in before creating a live share.");
      return null;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const shareSource = await resolveShareSource(noteId);
      if (!shareSource) {
        setStatusMessage("Could not find the selected note.");
        return null;
      }

      await pushNoteToRemote(shareSource.note, shareSource.content, nextAuthState);

      const normalizedPassword = password?.trim() ?? "";
      const shareEncryptedContent = await encryptNoteContent(
        shareSource.content,
        normalizedPassword
      );

      const share = await createRemoteShare(nextAuthState.session.tokens.accessToken, {
        noteId: shareSource.note.id,
        title: shareSource.note.title,
        format: shareSource.note.format,
        encryptedContent: shareEncryptedContent,
        password: normalizedPassword || undefined,
        maxViews: 25
      });

      await repository.recordShareHistory(shareSource.note.id, share);
      setSharePreview(share);
      setShareSlug(share.slug);
      await refreshShareHistory();
      setStatusMessage(normalizedPassword ? "Protected share created." : "Share link created.");
      return {
        ...share,
        url: resolveShareUrl(share.url)
      };
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause));
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function resolveShareSource(noteId: string) {
    const secret = deviceSecret;
    if (!secret) {
      return null;
    }

    if (activeStoredNote?.note.id === noteId) {
      return {
        note: {
          ...activeStoredNote.note,
          title: draft.title.trim() || activeStoredNote.note.title,
          format: draft.format,
          updatedAt: new Date().toISOString()
        },
        content: draft.content
      };
    }

    const note = await repository.getById(noteId);
    if (!note) {
      return null;
    }

    const content = await decryptNoteContent(note.encryptedContent, secret);
    return { note, content };
  }

  async function ensureFreshAuthState(): Promise<StoredAuthState | null> {
    const current = authState;
    if (!current) {
      return null;
    }

    try {
      await fetchCurrentUser(current.session.tokens.accessToken);
      return current;
    } catch (cause) {
      if (!(cause instanceof ApiClientError) || cause.status !== 401) {
        throw cause;
      }

      const refreshedSession = await refreshAuthSession(current.session.tokens.refreshToken);
      const nextState: StoredAuthState = {
        session: refreshedSession,
        syncSecret: current.syncSecret
      };
      await writeStoredAuthState(nextState);
      setAuthState(nextState);
      return nextState;
    }
  }

  async function restoreAuthState(): Promise<StoredAuthState | null> {
    const stored = await readStoredAuthState();
    if (!stored) {
      return null;
    }

    try {
      const user = await fetchCurrentUser(stored.session.tokens.accessToken);
      const hydrated: StoredAuthState = {
        ...stored,
        session: {
          ...stored.session,
          user
        }
      };
      await writeStoredAuthState(hydrated);
      return hydrated;
    } catch (cause) {
      if (!(cause instanceof ApiClientError) || cause.status !== 401) {
        await clearStoredAuthState();
        return null;
      }

      try {
        const refreshed = await refreshAuthSession(stored.session.tokens.refreshToken);
        const nextState: StoredAuthState = {
          session: refreshed,
          syncSecret: stored.syncSecret
        };
        await writeStoredAuthState(nextState);
        return nextState;
      } catch {
        await clearStoredAuthState();
        return null;
      }
    }
  }

  async function pushNoteToRemote(
    note: NoteRecord,
    content: string,
    sessionState: StoredAuthState
  ) {
    const remoteEncryptedContent = await encryptNoteContent(content, sessionState.syncSecret);
    const payload = {
      id: note.id,
      title: note.title,
      format: note.format,
      encryptedContent: remoteEncryptedContent,
      updatedAt: note.updatedAt,
      syncEnabled: true
    };

    try {
      await updateRemoteNote(sessionState.session.tokens.accessToken, note.id, payload);
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 404) {
        await createRemoteNote(sessionState.session.tokens.accessToken, payload);
        return;
      }

      throw cause;
    }
  }
}

function resolveShareUrl(urlOrPath: string): string {
  if (/^https?:\/\//i.test(urlOrPath)) {
    return urlOrPath;
  }

  return `${API_BASE_URL}${urlOrPath.startsWith("/") ? "" : "/"}${urlOrPath}`;
}

function mapShareHistoryItem(entry: ShareHistoryEntry, note?: NoteRecord): ShareHistoryItem {
  return {
    id: entry.id,
    noteId: entry.noteId,
    noteTitle: note?.title?.trim() || "Deleted note",
    shareSlug: entry.shareSlug,
    shareUrl: resolveShareUrl(`/shares/${entry.shareSlug}`),
    passwordProtected: entry.passwordProtected,
    maxViews: entry.maxViews,
    createdAt: entry.createdAt
  };
}

function getErrorMessage(cause: unknown): string {
  if (cause instanceof ApiClientError) {
    return cause.message;
  }

  return cause instanceof Error ? cause.message : "Unexpected application error.";
}

function buildSeedDraft(): NoteDraft {
  if (!seeded) {
    seeded = true;
  }

  return {
    title: "Offline study notes",
    content:
      "This is a sample encrypted note.\n\n- Stored locally first\n- Ready to sync or share later",
    format: "markdown"
  };
}
