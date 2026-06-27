import type { Prisma } from "@prisma/client";
import type {
  AccessLogRecord,
  CreateNoteInput,
  CreateShareInput,
  EncryptedNoteContent,
  NoteRecord,
  SharePolicy,
  ShareRecord,
  UpdateNoteInput,
  UserProfile
} from "@notesync/shared-types";
import { getPrismaClient } from "../lib/prisma";
import { createId, createSlug } from "../lib/id";
import type { AppStore, ShareLookupRecord, StoredUser } from "./store";

export class PrismaStore implements AppStore {
  readonly provider = "prisma" as const;
  private readonly prisma = getPrismaClient();

  async createUser(input: Omit<StoredUser, "id" | "createdAt">): Promise<UserProfile> {
    const user = await this.prisma.user.create({
      data: {
        id: createId(),
        email: input.email,
        displayName: input.displayName,
        passwordHash: input.passwordHash
      }
    });

    return mapUserProfile(user);
  }

  async findUserByEmail(email: string): Promise<StoredUser | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { email }
    });

    return user ? mapStoredUser(user) : undefined;
  }

  async getUserById(userId: string): Promise<UserProfile | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    return user ? mapUserProfile(user) : undefined;
  }

  async createNote(ownerId: string, input: CreateNoteInput): Promise<NoteRecord> {
    const note = await this.prisma.noteMetadata.create({
      data: {
        id: createId(),
        ownerId,
        title: input.title,
        format: input.format,
        status: "active",
        syncState: "local-only",
        encryptedContent: input.encryptedContent as unknown as Prisma.InputJsonValue
      }
    });

    return mapNoteRecord(note);
  }

  async updateNote(
    noteId: string,
    ownerId: string,
    input: UpdateNoteInput
  ): Promise<NoteRecord | undefined> {
    const existing = await this.prisma.noteMetadata.findFirst({
      where: {
        id: noteId,
        ownerId
      }
    });

    if (!existing) {
      return undefined;
    }

    const note = await this.prisma.noteMetadata.update({
      where: { id: noteId },
      data: {
        title: input.title ?? existing.title,
        format: input.format ?? existing.format,
        status: input.status ?? existing.status,
        syncState: "pending-sync",
        encryptedContent: (input.encryptedContent ?? existing.encryptedContent) as Prisma.InputJsonValue
      }
    });

    return mapNoteRecord(note);
  }

  async listNotes(ownerId: string): Promise<NoteRecord[]> {
    const notes = await this.prisma.noteMetadata.findMany({
      where: { ownerId },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return notes.map(mapNoteRecord);
  }

  async getNote(noteId: string, ownerId: string): Promise<NoteRecord | undefined> {
    const note = await this.prisma.noteMetadata.findFirst({
      where: {
        id: noteId,
        ownerId
      }
    });

    return note ? mapNoteRecord(note) : undefined;
  }

  async createShare(
    ownerId: string,
    input: CreateShareInput,
    passwordHash?: string
  ): Promise<ShareRecord> {
    const share = await this.prisma.sharedNote.create({
      data: {
        id: createId(),
        noteId: input.noteId,
        slug: createSlug(),
        createdBy: ownerId,
        encryptedContent: input.encryptedContent as unknown as Prisma.InputJsonValue,
        title: input.title,
        format: input.format,
        policy: {
          passwordProtected: Boolean(passwordHash),
          maxViews: input.maxViews,
          expiresAt: input.expiresAt
        } as Prisma.InputJsonValue,
        passwordHash
      }
    });

    return mapShareRecord(share);
  }

  async getShareBySlug(slug: string): Promise<ShareLookupRecord | undefined> {
    const share = await this.prisma.sharedNote.findUnique({
      where: { slug }
    });

    return share ? mapShareLookupRecord(share) : undefined;
  }

  async incrementShareAccess(slug: string): Promise<ShareRecord | undefined> {
    const share = await this.prisma.sharedNote.findUnique({
      where: { slug }
    });

    if (!share) {
      return undefined;
    }

    const updated = await this.prisma.sharedNote.update({
      where: { slug },
      data: {
        accessCount: {
          increment: 1
        }
      }
    });

    return mapShareRecord(updated);
  }

  async createAccessLog(shareId: string, success: boolean): Promise<AccessLogRecord> {
    const log = await this.prisma.shareAccessLog.create({
      data: {
        id: createId(),
        shareId,
        success
      }
    });

    return {
      id: log.id,
      shareId: log.shareId,
      accessedAt: log.accessedAt.toISOString(),
      success: log.success
    };
  }
}

function mapUserProfile(user: {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
}): UserProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString()
  };
}

function mapStoredUser(user: {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: Date;
}): StoredUser {
  return {
    ...mapUserProfile(user),
    passwordHash: user.passwordHash
  };
}

function mapNoteRecord(note: {
  id: string;
  ownerId: string;
  title: string;
  format: string;
  status: string;
  syncState: string;
  encryptedContent: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): NoteRecord {
  return {
    id: note.id,
    ownerId: note.ownerId,
    title: note.title,
    format: note.format as NoteRecord["format"],
    status: note.status as NoteRecord["status"],
    syncState: note.syncState as NoteRecord["syncState"],
    encryptedContent: note.encryptedContent as unknown as EncryptedNoteContent,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString()
  };
}

function mapSharePolicy(policy: Prisma.JsonValue): SharePolicy {
  return policy as unknown as SharePolicy;
}

function mapShareRecord(share: {
  id: string;
  noteId: string;
  slug: string;
  createdBy: string;
  encryptedContent: Prisma.JsonValue;
  title: string;
  format: string;
  policy: Prisma.JsonValue;
  createdAt: Date;
  accessCount: number;
}): ShareRecord {
  return {
    id: share.id,
    noteId: share.noteId,
    slug: share.slug,
    createdBy: share.createdBy,
    encryptedContent: share.encryptedContent as unknown as EncryptedNoteContent,
    title: share.title,
    format: share.format as ShareRecord["format"],
    policy: mapSharePolicy(share.policy),
    createdAt: share.createdAt.toISOString(),
    accessCount: share.accessCount
  };
}

function mapShareLookupRecord(share: {
  id: string;
  noteId: string;
  slug: string;
  createdBy: string;
  encryptedContent: Prisma.JsonValue;
  title: string;
  format: string;
  policy: Prisma.JsonValue;
  createdAt: Date;
  accessCount: number;
  passwordHash: string | null;
}): ShareLookupRecord {
  return {
    ...mapShareRecord(share),
    passwordHash: share.passwordHash ?? undefined
  };
}
