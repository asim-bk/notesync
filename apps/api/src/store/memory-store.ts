import type {
  AccessLogRecord,
  CreateNoteInput,
  CreateShareInput,
  NoteRecord,
  ShareRecord,
  UpdateNoteInput,
  UserProfile
} from "@notesync/shared-types";
import { createId, createSlug } from "../lib/id";

interface StoredUser extends UserProfile {
  passwordHash: string;
}

export class MemoryStore {
  private readonly users = new Map<string, StoredUser>();
  private readonly notes = new Map<string, NoteRecord>();
  private readonly shares = new Map<string, ShareRecord & { passwordHash?: string }>();
  private readonly accessLogs: AccessLogRecord[] = [];

  createUser(input: Omit<StoredUser, "id" | "createdAt">): UserProfile {
    const user: StoredUser = {
      id: createId(),
      createdAt: new Date().toISOString(),
      ...input
    };
    this.users.set(user.id, user);
    return sanitizeUser(user);
  }

  findUserByEmail(email: string): StoredUser | undefined {
    return [...this.users.values()].find((user) => user.email === email);
  }

  getUserById(userId: string): UserProfile | undefined {
    const user = this.users.get(userId);
    return user ? sanitizeUser(user) : undefined;
  }

  createNote(ownerId: string, input: CreateNoteInput): NoteRecord {
    const note: NoteRecord = {
      id: createId(),
      ownerId,
      title: input.title,
      format: input.format,
      encryptedContent: input.encryptedContent,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncState: "local-only"
    };

    this.notes.set(note.id, note);
    return note;
  }

  updateNote(noteId: string, ownerId: string, input: UpdateNoteInput): NoteRecord | undefined {
    const note = this.notes.get(noteId);
    if (!note || note.ownerId !== ownerId) {
      return undefined;
    }

    const updated: NoteRecord = {
      ...note,
      ...input,
      updatedAt: new Date().toISOString(),
      syncState: "pending-sync"
    };
    this.notes.set(noteId, updated);
    return updated;
  }

  listNotes(ownerId: string): NoteRecord[] {
    return [...this.notes.values()].filter((note) => note.ownerId === ownerId);
  }

  getNote(noteId: string, ownerId: string): NoteRecord | undefined {
    const note = this.notes.get(noteId);
    if (!note || note.ownerId !== ownerId) {
      return undefined;
    }
    return note;
  }

  createShare(
    ownerId: string,
    input: CreateShareInput,
    passwordHash?: string
  ): ShareRecord {
    const share: ShareRecord & { passwordHash?: string } = {
      id: createId(),
      noteId: input.noteId,
      slug: createSlug(),
      createdBy: ownerId,
      encryptedContent: input.encryptedContent,
      title: input.title,
      format: input.format,
      policy: {
        passwordProtected: Boolean(passwordHash),
        maxViews: input.maxViews,
        expiresAt: input.expiresAt
      },
      createdAt: new Date().toISOString(),
      accessCount: 0,
      passwordHash
    };

    this.shares.set(share.slug, share);
    return sanitizeShare(share);
  }

  getShareBySlug(slug: string): (ShareRecord & { passwordHash?: string }) | undefined {
    return this.shares.get(slug);
  }

  incrementShareAccess(slug: string): ShareRecord | undefined {
    const share = this.shares.get(slug);
    if (!share) {
      return undefined;
    }
    share.accessCount += 1;
    this.shares.set(slug, share);
    return sanitizeShare(share);
  }

  createAccessLog(shareId: string, success: boolean): AccessLogRecord {
    const log: AccessLogRecord = {
      id: createId(),
      shareId,
      accessedAt: new Date().toISOString(),
      success
    };
    this.accessLogs.push(log);
    return log;
  }
}

function sanitizeUser(user: StoredUser): UserProfile {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function sanitizeShare(
  share: ShareRecord & { passwordHash?: string }
): ShareRecord {
  const { passwordHash: _passwordHash, ...safeShare } = share;
  return safeShare;
}
