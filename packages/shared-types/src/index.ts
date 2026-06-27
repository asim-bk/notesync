export type ISODateString = string;

export type NoteFormat = "markdown" | "html" | "rtf";
export type NoteStatus = "active" | "archived";
export type SyncState = "local-only" | "pending-sync" | "synced";

export interface NoteSummary {
  id: string;
  title: string;
  excerpt: string;
  format: NoteFormat;
  updatedAt: ISODateString;
  syncState: SyncState;
  syncEnabled: boolean;
  encrypted: boolean;
}

export interface EncryptedNoteContent {
  cipherText: string;
  iv: string;
  salt: string;
  algorithm: "AES-256-GCM";
  version: number;
}

export interface NoteRecord {
  id: string;
  ownerId: string;
  title: string;
  format: NoteFormat;
  status: NoteStatus;
  encryptedContent: EncryptedNoteContent;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  syncState: SyncState;
  syncEnabled: boolean;
}

export interface NoteDraft {
  title: string;
  content: string;
  format: NoteFormat;
}

export interface CreateNoteInput {
  id?: string;
  title: string;
  format: NoteFormat;
  encryptedContent: EncryptedNoteContent;
  updatedAt?: ISODateString;
  syncEnabled?: boolean;
}

export interface UpdateNoteInput {
  title?: string;
  format?: NoteFormat;
  encryptedContent?: EncryptedNoteContent;
  status?: NoteStatus;
  updatedAt?: ISODateString;
  syncEnabled?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  createdAt: ISODateString;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface AuthSession {
  user: UserProfile;
  tokens: AuthTokens;
}

export interface SharePolicy {
  passwordProtected: boolean;
  maxViews?: number;
  expiresAt?: ISODateString;
}

export interface ShareRecord {
  id: string;
  noteId: string;
  slug: string;
  createdBy: string;
  encryptedContent: EncryptedNoteContent;
  title: string;
  format: NoteFormat;
  policy: SharePolicy;
  createdAt: ISODateString;
  accessCount: number;
}

export interface CreateShareInput {
  noteId: string;
  title: string;
  format: NoteFormat;
  encryptedContent: EncryptedNoteContent;
  password?: string;
  expiresAt?: ISODateString;
  maxViews?: number;
}

export interface ShareCreationResult extends ShareRecord {
  url: string;
}

export interface SharedNoteAccessRequest {
  password?: string;
}

export interface SharedNoteAccessResponse {
  share: Pick<ShareRecord, "slug" | "title" | "format" | "createdAt">;
  encryptedContent: EncryptedNoteContent;
}

export interface AccessLogRecord {
  id: string;
  shareId: string;
  accessedAt: ISODateString;
  success: boolean;
}

export interface ApiErrorPayload {
  message: string;
  code: string;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: ApiErrorPayload;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
