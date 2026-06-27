import fastify from "fastify";
import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import type {
  CreateNoteInput,
  CreateShareInput,
  LoginInput,
  RegisterInput,
  UpdateNoteInput
} from "@notesync/shared-types";
import { canAccessShare } from "@notesync/note-domain";
import { config } from "./config";
import { compareSecret, hashSecret } from "./lib/security";
import { createAppStore } from "./store/create-store";
import type { AppStore } from "./store/store";

declare module "fastify" {
  interface FastifyInstance {
    store: AppStore;
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

interface AuthJwtPayload {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export function createApp() {
  const app = fastify({ logger: true });
  const store = createAppStore();

  app.decorate("store", store);

  app.register(cors, {
    origin: true
  });

  app.register(jwt, {
    secret: config.jwtSecret
  });

  app.decorate("authenticate", async function authenticate(request, reply) {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({
        ok: false,
        error: {
          code: "unauthorized",
          message: "Authentication is required."
        }
      });
    }
  });

  app.get("/health", async () => {
    return {
      ok: true,
      data: {
        service: "notesync-api",
        status: "ok",
        timestamp: new Date().toISOString(),
        storeProvider: config.storeProvider
      }
    };
  });

  app.post<{ Body: RegisterInput }>("/auth/register", async (request, reply) => {
    const existingUser = await store.findUserByEmail(request.body.email);
    if (existingUser) {
      return reply.status(409).send({
        ok: false,
        error: {
          code: "email-in-use",
          message: "This email address is already registered."
        }
      });
    }

    const user = await store.createUser({
      email: request.body.email,
      displayName: request.body.displayName,
      passwordHash: hashSecret(request.body.password)
    });

    const tokens = await issueTokens(app, user);
    return reply.status(201).send({
      ok: true,
      data: {
        user,
        tokens
      }
    });
  });

  app.post<{ Body: LoginInput }>("/auth/login", async (request, reply) => {
    const user = await store.findUserByEmail(request.body.email);
    if (!user || !compareSecret(request.body.password, user.passwordHash)) {
      return reply.status(401).send({
        ok: false,
        error: {
          code: "invalid-credentials",
          message: "Email or password is incorrect."
        }
      });
    }

    const safeUser = await store.getUserById(user.id);
    if (!safeUser) {
      return reply.status(404).send({
        ok: false,
        error: {
          code: "user-not-found",
          message: "User record could not be loaded."
        }
      });
    }
    const tokens = await issueTokens(app, safeUser);
    return {
      ok: true,
      data: {
        user: safeUser,
        tokens
      }
    };
  });

  app.get(
    "/notes",
    {
      preHandler: [app.authenticate]
    },
    async (request) => {
      const user = getAuthUser(request);
      const notes = await store.listNotes(user.id);
      return {
        ok: true,
        data: notes
      };
    }
  );

  app.post<{ Body: CreateNoteInput }>(
    "/notes",
    {
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const note = await store.createNote(user.id, request.body);
      return reply.status(201).send({
        ok: true,
        data: note
      });
    }
  );

  app.put<{ Params: { id: string }; Body: UpdateNoteInput }>(
    "/notes/:id",
    {
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const note = await store.updateNote(request.params.id, user.id, request.body);
      if (!note) {
        return reply.status(404).send({
          ok: false,
          error: {
            code: "note-not-found",
            message: "Requested note was not found."
          }
        });
      }

      return {
        ok: true,
        data: note
      };
    }
  );

  app.post<{ Body: CreateShareInput }>(
    "/shares",
    {
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const note = await store.getNote(request.body.noteId, user.id);
      if (!note) {
        return reply.status(404).send({
          ok: false,
          error: {
            code: "note-not-found",
            message: "Cannot share a note that does not exist."
          }
        });
      }

      const passwordHash = request.body.password
        ? hashSecret(request.body.password)
        : undefined;

      const share = await store.createShare(user.id, request.body, passwordHash);
      return reply.status(201).send({
        ok: true,
        data: {
          ...share,
          url: `/shares/${share.slug}`
        }
      });
    }
  );

  app.post<{ Params: { slug: string }; Body: { password?: string } }>(
    "/shares/:slug/access",
    async (request, reply) => {
      const share = await store.getShareBySlug(request.params.slug);
      if (!share) {
        return reply.status(404).send({
          ok: false,
          error: {
            code: "share-not-found",
            message: "Shared note could not be found."
          }
        });
      }

      const access = canAccessShare(share.policy, share.accessCount);
      if (!access.allowed) {
        await store.createAccessLog(share.id, false);
        return reply.status(410).send({
          ok: false,
          error: {
            code: access.reason ?? "share-unavailable",
            message: "This shared note is no longer available."
          }
        });
      }

      if (share.passwordHash) {
        if (!request.body?.password || !compareSecret(request.body.password, share.passwordHash)) {
          await store.createAccessLog(share.id, false);
          return reply.status(401).send({
            ok: false,
            error: {
              code: "invalid-share-password",
              message: "A valid share password is required."
            }
          });
        }
      }

      await store.incrementShareAccess(share.slug);
      await store.createAccessLog(share.id, true);

      return {
        ok: true,
        data: {
          share: {
            slug: share.slug,
            title: share.title,
            format: share.format,
            createdAt: share.createdAt
          },
          encryptedContent: share.encryptedContent
        }
      };
    }
  );

  return app;
}

async function issueTokens(
  app: FastifyInstance,
  user: { id: string; email: string; displayName: string; createdAt: string }
) {
  const accessToken = await app.jwt.sign(user, { expiresIn: "15m" });
  const refreshToken = await app.jwt.sign(
    { sub: user.id, type: "refresh" },
    { expiresIn: "7d" }
  );

  return {
    accessToken,
    refreshToken,
    expiresInSeconds: 900
  };
}

function getAuthUser(request: FastifyRequest): AuthJwtPayload {
  return request.user as AuthJwtPayload;
}
