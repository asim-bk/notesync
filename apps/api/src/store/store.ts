import type {
  AccessLogRecord,
  CreateNoteInput,
  CreateShareInput,
  NoteRecord,
  ShareRecord,
  UpdateNoteInput,
  UserProfile
} from "@notesync/shared-types";

export interface StoredUser extends UserProfile {
  passwordHash: string;
}

export type ShareLookupRecord = ShareRecord & { passwordHash?: string };

export interface RefreshSessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface AppStore {
  provider: "memory" | "prisma";
  healthcheck(): Promise<void>;
  createUser(input: Omit<StoredUser, "id" | "createdAt">): Promise<UserProfile>;
  findUserByEmail(email: string): Promise<StoredUser | undefined>;
  getUserById(userId: string): Promise<UserProfile | undefined>;
  createRefreshSession(input: {
    id: string;
    userId: string;
    refreshTokenHash: string;
    expiresAt: string;
  }): Promise<RefreshSessionRecord>;
  getRefreshSession(sessionId: string): Promise<RefreshSessionRecord | undefined>;
  revokeRefreshSession(sessionId: string): Promise<void>;
  createNote(ownerId: string, input: CreateNoteInput): Promise<NoteRecord>;
  updateNote(noteId: string, ownerId: string, input: UpdateNoteInput): Promise<NoteRecord | undefined>;
  deleteNote(noteId: string, ownerId: string): Promise<boolean>;
  listNotes(ownerId: string): Promise<NoteRecord[]>;
  getNote(noteId: string, ownerId: string): Promise<NoteRecord | undefined>;
  createShare(ownerId: string, input: CreateShareInput, passwordHash?: string): Promise<ShareRecord>;
  getShareBySlug(slug: string): Promise<ShareLookupRecord | undefined>;
  incrementShareAccess(slug: string): Promise<ShareRecord | undefined>;
  createAccessLog(shareId: string, success: boolean): Promise<AccessLogRecord>;
}
