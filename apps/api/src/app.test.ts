import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "./app";

const encryptedContent = {
  cipherText: "cipher",
  iv: "iv",
  salt: "salt",
  algorithm: "AES-256-GCM" as const,
  version: 1
};

test("auth, refresh, and share flow works end to end", async (t) => {
  const app = createApp();
  await app.ready();
  t.after(async () => {
    await app.close();
  });

  const registerResponse = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "tester@example.com",
      password: "StrongPass123",
      displayName: "Test User"
    }
  });

  assert.equal(registerResponse.statusCode, 201);
  const registerPayload = registerResponse.json();
  assert.equal(registerPayload.ok, true);

  const invalidLogin = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: "tester@example.com",
      password: "wrong-pass"
    }
  });
  assert.equal(invalidLogin.statusCode, 401);

  const loginResponse = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: "tester@example.com",
      password: "StrongPass123"
    }
  });
  assert.equal(loginResponse.statusCode, 200);
  const loginPayload = loginResponse.json();
  const accessToken = loginPayload.data.tokens.accessToken as string;
  const refreshToken = loginPayload.data.tokens.refreshToken as string;

  const meResponse = await app.inject({
    method: "GET",
    url: "/auth/me",
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });
  assert.equal(meResponse.statusCode, 200);

  const noteResponse = await app.inject({
    method: "POST",
    url: "/notes",
    headers: {
      authorization: `Bearer ${accessToken}`
    },
    payload: {
      id: "note-1",
      title: "Synced note",
      format: "markdown",
      encryptedContent,
      syncEnabled: true
    }
  });
  assert.equal(noteResponse.statusCode, 201);

  const shareResponse = await app.inject({
    method: "POST",
    url: "/shares",
    headers: {
      authorization: `Bearer ${accessToken}`
    },
    payload: {
      noteId: "note-1",
      title: "Synced note",
      format: "markdown",
      encryptedContent,
      password: "SharePass123",
      maxViews: 2
    }
  });
  assert.equal(shareResponse.statusCode, 201);
  const sharePayload = shareResponse.json();
  const slug = sharePayload.data.slug as string;

  const deniedShareAccess = await app.inject({
    method: "POST",
    url: `/shares/${slug}/access`,
    payload: {
      password: "wrong-password"
    }
  });
  assert.equal(deniedShareAccess.statusCode, 401);

  const grantedShareAccess = await app.inject({
    method: "POST",
    url: `/shares/${slug}/access`,
    payload: {
      password: "SharePass123"
    }
  });
  assert.equal(grantedShareAccess.statusCode, 200);

  const refreshResponse = await app.inject({
    method: "POST",
    url: "/auth/refresh",
    payload: {
      refreshToken
    }
  });
  assert.equal(refreshResponse.statusCode, 200);
  const refreshedToken = refreshResponse.json().data.tokens.refreshToken as string;

  const logoutResponse = await app.inject({
    method: "POST",
    url: "/auth/logout",
    payload: {
      refreshToken: refreshedToken
    }
  });
  assert.equal(logoutResponse.statusCode, 204);

  const rejectedRefresh = await app.inject({
    method: "POST",
    url: "/auth/refresh",
    payload: {
      refreshToken: refreshedToken
    }
  });
  assert.equal(rejectedRefresh.statusCode, 401);
});

test("invalid login attempts are throttled", async (t) => {
  const app = createApp();
  await app.ready();
  t.after(async () => {
    await app.close();
  });

  await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "limit@example.com",
      password: "StrongPass123",
      displayName: "Limit User"
    }
  });

  for (let index = 0; index < 5; index += 1) {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "limit@example.com",
        password: "bad-password"
      }
    });
    assert.equal(response.statusCode, 401);
  }

  const throttled = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      email: "limit@example.com",
      password: "bad-password"
    }
  });

  assert.equal(throttled.statusCode, 429);
});
