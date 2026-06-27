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

export interface AppStore {
  provider: "memory" | "prisma";
  createUser(input: Omit<StoredUser, "id" | "createdAt">): Promise<UserProfile>;
  findUserByEmail(email: string): Promise<StoredUser | undefined>;
  getUserById(userId: string): Promise<UserProfile | undefined>;
  createNote(ownerId: string, input: CreateNoteInput): Promise<NoteRecord>;
  updateNote(noteId: string, ownerId: string, input: UpdateNoteInput): Promise<NoteRecord | undefined>;
  listNotes(ownerId: string): Promise<NoteRecord[]>;
  getNote(noteId: string, ownerId: string): Promise<NoteRecord | undefined>;
  createShare(ownerId: string, input: CreateShareInput, passwordHash?: string): Promise<ShareRecord>;
  getShareBySlug(slug: string): Promise<ShareLookupRecord | undefined>;
  incrementShareAccess(slug: string): Promise<ShareRecord | undefined>;
  createAccessLog(shareId: string, success: boolean): Promise<AccessLogRecord>;
}
