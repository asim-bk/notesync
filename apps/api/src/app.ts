import fastify from "fastify";
import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import type {
  CreateNoteInput,
  CreateShareInput,
  LoginInput,
  RefreshTokenInput,
  RegisterInput,
  UpdateNoteInput
} from "@notesync/shared-types";
import { canAccessShare } from "@notesync/note-domain";
import { config } from "./config";
import { createId } from "./lib/id";
import { FixedWindowRateLimiter } from "./lib/rate-limit";
import {
  compareSecret,
  hashOpaqueToken,
  hashSecret,
  isValidEmail,
  isValidPassword,
  normalizeEmail
} from "./lib/security";
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
  type: "access";
}

interface RefreshJwtPayload {
  sub: string;
  sessionId: string;
  type: "refresh";
  iat?: number;
  exp?: number;
}

const registerAttemptLimiter = new FixedWindowRateLimiter(10, 60_000);
const loginFailureLimiter = new FixedWindowRateLimiter(5, 10 * 60_000);
const shareAccessFailureLimiter = new FixedWindowRateLimiter(10, 10 * 60_000);

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
      return reply.status(401).send({
        ok: false,
        error: {
          code: "unauthorized",
          message: "Authentication is required."
        }
      });
    }
  });

  app.get("/health", async () => {
    await store.healthcheck();
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
    const registerKey = `register:${request.ip}`;
    const registerWindow = registerAttemptLimiter.consume(registerKey);
    if (!registerWindow.allowed) {
      return sendRateLimitError(reply, "too-many-register-attempts", registerWindow.retryAfterSeconds);
    }

    const email = normalizeEmail(request.body.email);
    if (!isValidEmail(email)) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: "invalid-email",
          message: "A valid email address is required."
        }
      });
    }

    if (!isValidPassword(request.body.password)) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: "weak-password",
          message: "Password must be at least 8 characters long."
        }
      });
    }

    const existingUser = await store.findUserByEmail(email);
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
      email,
      displayName: request.body.displayName.trim() || "NoteSync User",
      passwordHash: hashSecret(request.body.password)
    });

    const tokens = await issueTokens(app, store, user);
    return reply.status(201).send({
      ok: true,
      data: {
        user,
        tokens
      }
    });
  });

  app.post<{ Body: LoginInput }>("/auth/login", async (request, reply) => {
    const email = normalizeEmail(request.body.email);
    const loginKey = buildAuthRateLimitKey(request.ip, email);
    const loginWindow = loginFailureLimiter.check(loginKey);

    if (!loginWindow.allowed) {
      return sendRateLimitError(reply, "too-many-login-attempts", loginWindow.retryAfterSeconds);
    }

    const user = await store.findUserByEmail(email);
    if (!user || !compareSecret(request.body.password, user.passwordHash)) {
      loginFailureLimiter.consume(loginKey);
      return reply.status(401).send({
        ok: false,
        error: {
          code: "invalid-credentials",
          message: "Email or password is incorrect."
        }
      });
    }

    loginFailureLimiter.reset(loginKey);

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

    const tokens = await issueTokens(app, store, safeUser);
    return {
      ok: true,
      data: {
        user: safeUser,
        tokens
      }
    };
  });

  app.get(
    "/auth/me",
    {
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const user = await store.getUserById(authUser.id);
      if (!user) {
        return reply.status(404).send({
          ok: false,
          error: {
            code: "user-not-found",
            message: "User record could not be loaded."
          }
        });
      }

      return {
        ok: true,
        data: user
      };
    }
  );

  app.post<{ Body: RefreshTokenInput }>("/auth/refresh", async (request, reply) => {
    const payload = await verifyRefreshToken(app, request.body.refreshToken);
    if (!payload) {
      return reply.status(401).send({
        ok: false,
        error: {
          code: "invalid-refresh-token",
          message: "A valid refresh token is required."
        }
      });
    }

    const session = await store.getRefreshSession(payload.sessionId);
    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      new Date(session.expiresAt).getTime() <= Date.now() ||
      !compareOpaqueToken(request.body.refreshToken, session.refreshTokenHash)
    ) {
      if (session && !session.revokedAt) {
        await store.revokeRefreshSession(session.id);
      }

      return reply.status(401).send({
        ok: false,
        error: {
          code: "refresh-session-invalid",
          message: "Refresh session is invalid or expired."
        }
      });
    }

    await store.revokeRefreshSession(session.id);

    const user = await store.getUserById(payload.sub);
    if (!user) {
      return reply.status(404).send({
        ok: false,
        error: {
          code: "user-not-found",
          message: "User record could not be loaded."
        }
      });
    }

    const tokens = await issueTokens(app, store, user);
    return {
      ok: true,
      data: {
        user,
        tokens
      }
    };
  });

  app.post<{ Body: RefreshTokenInput }>("/auth/logout", async (request, reply) => {
    const payload = await verifyRefreshToken(app, request.body.refreshToken);
    if (payload) {
      await store.revokeRefreshSession(payload.sessionId);
    }

    return reply.status(204).send();
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

  app.delete<{ Params: { id: string } }>(
    "/notes/:id",
    {
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      const user = getAuthUser(request);
      const deleted = await store.deleteNote(request.params.id, user.id);
      if (!deleted) {
        return reply.status(404).send({
          ok: false,
          error: {
            code: "note-not-found",
            message: "Requested note was not found."
          }
        });
      }

      return reply.status(204).send();
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

      const shareKey = `share:${request.ip}:${request.params.slug}`;
      const shareWindow = shareAccessFailureLimiter.check(shareKey);
      if (!shareWindow.allowed) {
        return sendRateLimitError(reply, "too-many-share-attempts", shareWindow.retryAfterSeconds);
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
          shareAccessFailureLimiter.consume(shareKey);
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

      shareAccessFailureLimiter.reset(shareKey);
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
  store: AppStore,
  user: { id: string; email: string; displayName: string; createdAt: string }
) {
  const accessToken = await app.jwt.sign(
    {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
      type: "access"
    },
    { expiresIn: config.accessTokenTtlSeconds }
  );

  const sessionId = createId();
  const refreshToken = await app.jwt.sign(
    { sub: user.id, sessionId, type: "refresh" },
    { expiresIn: config.refreshTokenTtlSeconds }
  );

  await store.createRefreshSession({
    id: sessionId,
    userId: user.id,
    refreshTokenHash: hashOpaqueToken(refreshToken),
    expiresAt: new Date(Date.now() + config.refreshTokenTtlSeconds * 1000).toISOString()
  });

  return {
    accessToken,
    refreshToken,
    expiresInSeconds: config.accessTokenTtlSeconds
  };
}

async function verifyRefreshToken(
  app: FastifyInstance,
  refreshToken?: string
): Promise<RefreshJwtPayload | null> {
  if (!refreshToken) {
    return null;
  }

  try {
    const payload = await app.jwt.verify<RefreshJwtPayload>(refreshToken);
    if (payload.type !== "refresh" || !payload.sub || !payload.sessionId) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function compareOpaqueToken(token: string, tokenHash: string): boolean {
  return hashOpaqueToken(token) === tokenHash;
}

function buildAuthRateLimitKey(ip: string, email: string): string {
  return `auth:${ip}:${email}`;
}

function sendRateLimitError(
  reply: FastifyReply,
  code: string,
  retryAfterSeconds: number
) {
  reply.header("Retry-After", `${retryAfterSeconds}`);
  return reply.status(429).send({
    ok: false,
    error: {
      code,
      message: "Too many attempts. Please try again later."
    }
  });
}

function getAuthUser(request: FastifyRequest): AuthJwtPayload {
  return request.user as AuthJwtPayload;
}
