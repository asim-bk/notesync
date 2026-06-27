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
import type { AppStore, ShareLookupRecord, StoredUser } from "./store";

export class MemoryStore implements AppStore {
  readonly provider = "memory" as const;
  private readonly users = new Map<string, StoredUser>();
  private readonly notes = new Map<string, NoteRecord>();
  private readonly shares = new Map<string, ShareLookupRecord>();
  private readonly accessLogs: AccessLogRecord[] = [];

  async createUser(input: Omit<StoredUser, "id" | "createdAt">): Promise<UserProfile> {
    const user: StoredUser = {
      id: createId(),
      createdAt: new Date().toISOString(),
      ...input
    };
    this.users.set(user.id, user);
    return sanitizeUser(user);
  }

  async findUserByEmail(email: string): Promise<StoredUser | undefined> {
    return [...this.users.values()].find((user) => user.email === email);
  }

  async getUserById(userId: string): Promise<UserProfile | undefined> {
    const user = this.users.get(userId);
    return user ? sanitizeUser(user) : undefined;
  }

  async createNote(ownerId: string, input: CreateNoteInput): Promise<NoteRecord> {
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

  async updateNote(
    noteId: string,
    ownerId: string,
    input: UpdateNoteInput
  ): Promise<NoteRecord | undefined> {
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

  async listNotes(ownerId: string): Promise<NoteRecord[]> {
    return [...this.notes.values()].filter((note) => note.ownerId === ownerId);
  }

  async getNote(noteId: string, ownerId: string): Promise<NoteRecord | undefined> {
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
  ): Promise<ShareRecord> {
    const share: ShareLookupRecord = {
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
    return Promise.resolve(sanitizeShare(share));
  }

  async getShareBySlug(slug: string): Promise<ShareLookupRecord | undefined> {
    return this.shares.get(slug);
  }

  async incrementShareAccess(slug: string): Promise<ShareRecord | undefined> {
    const share = this.shares.get(slug);
    if (!share) {
      return undefined;
    }
    share.accessCount += 1;
    this.shares.set(slug, share);
    return sanitizeShare(share);
  }

  async createAccessLog(shareId: string, success: boolean): Promise<AccessLogRecord> {
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
  share: ShareLookupRecord
): ShareRecord {
  const { passwordHash: _passwordHash, ...safeShare } = share;
  return safeShare;
}
