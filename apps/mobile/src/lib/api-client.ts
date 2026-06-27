import type {
  ApiResponse,
  AuthSession,
  CreateNoteInput,
  CreateShareInput,
  LoginInput,
  NoteRecord,
  RefreshTokenInput,
  RegisterInput,
  ShareCreationResult,
  SharedNoteAccessResponse,
  UpdateNoteInput,
  UserProfile
} from "@notesync/shared-types";
import { API_BASE_URL } from "./app-config";

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number
  ) {
    super(message);
  }
}

export async function register(input: RegisterInput): Promise<AuthSession> {
  return request<AuthSession>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function login(input: LoginInput): Promise<AuthSession> {
  return request<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function refreshAuthSession(refreshToken: string): Promise<AuthSession> {
  return request<AuthSession>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken } satisfies RefreshTokenInput)
  });
}

export async function logout(refreshToken: string): Promise<void> {
  await request<void>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken } satisfies RefreshTokenInput)
  });
}

export async function fetchCurrentUser(accessToken: string): Promise<UserProfile> {
  return request<UserProfile>("/auth/me", {
    method: "GET",
    accessToken
  });
}

export async function listRemoteNotes(accessToken: string): Promise<NoteRecord[]> {
  return request<NoteRecord[]>("/notes", {
    method: "GET",
    accessToken
  });
}

export async function createRemoteNote(
  accessToken: string,
  input: CreateNoteInput
): Promise<NoteRecord> {
  return request<NoteRecord>("/notes", {
    method: "POST",
    accessToken,
    body: JSON.stringify(input)
  });
}

export async function updateRemoteNote(
  accessToken: string,
  noteId: string,
  input: UpdateNoteInput
): Promise<NoteRecord> {
  return request<NoteRecord>(`/notes/${noteId}`, {
    method: "PUT",
    accessToken,
    body: JSON.stringify(input)
  });
}

export async function deleteRemoteNote(
  accessToken: string,
  noteId: string
): Promise<void> {
  await request<void>(`/notes/${noteId}`, {
    method: "DELETE",
    accessToken
  });
}

export async function createRemoteShare(
  accessToken: string,
  input: CreateShareInput
): Promise<ShareCreationResult> {
  return request<ShareCreationResult>("/shares", {
    method: "POST",
    accessToken,
    body: JSON.stringify(input)
  });
}

export async function accessRemoteShare(
  slug: string,
  password?: string
): Promise<SharedNoteAccessResponse> {
  return request<SharedNoteAccessResponse>(`/shares/${slug}/access`, {
    method: "POST",
    body: JSON.stringify(password ? { password } : {})
  });
}

interface RequestOptions {
  method: "DELETE" | "GET" | "POST" | "PUT";
  accessToken?: string;
  body?: string;
}

async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {})
    },
    body: options.body
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) {
    const error = (payload as { error: { message: string; code: string } }).error;
    throw new ApiClientError(
      error.message,
      error.code,
      response.status
    );
  }

  return payload.data;
}
