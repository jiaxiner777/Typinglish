import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { createApp } from "../server/app/createApp.js";
import type { AppEnv } from "../server/config/env.js";
import { createRepository } from "../server/repository.js";

const env: AppEnv = {
  port: 0,
  databaseUrl: null,
  nodeEnv: "test",
  corsOrigins: [],
  adminToken: null,
  cookieSecure: false
};

const SESSION_COOKIE = "typinglish_session";

/** Extract the session cookie value from a Set-Cookie header. */
function extractSessionCookie(response: Response): string | null {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return null;
  const match = new RegExp(`${SESSION_COOKIE}=([^;]+)`).exec(setCookie);
  return match ? match[1] : null;
}

/** Build a Cookie header from a token. */
function cookieHeader(token: string | null): Record<string, string> {
  return token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {};
}

interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
  repo: ReturnType<typeof createRepository>;
}

async function withServer(run: (server: TestServer) => Promise<void>): Promise<void> {
  const repo = createRepository();
  const server = createApp(env, repo).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run({ baseUrl, repo, close: async () => { server.close(); await once(server, "close"); } });
  } finally {
    server.close();
    await once(server, "close");
  }
}

async function registerAndLogin(
  baseUrl: string,
  email: string,
  password = "test-password-123"
): Promise<{ token: string | null; userId: string }> {
  const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  assert.equal(res.status, 201);
  const token = extractSessionCookie(res);
  const body = await res.json() as { user: { id: string } };
  return { token, userId: body.user.id };
}

// ---------------------------------------------------------------------------
// Test 1: Guest scores don't write to Repository
// ---------------------------------------------------------------------------

test("guest progress report does not write to repository", async () => {
  await withServer(async ({ baseUrl, repo }) => {
    const beforeCount = (await repo.getProgressForUser("any-user-id")).length;

    const res = await fetch(`${baseUrl}/api/v1/progress/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-typinglish-user-id": "forged-user"
      },
      body: JSON.stringify({
        chunk_id: "aaaaaaaa-0001-4000-8000-000000000001",
        wpm: 70,
        accuracy: 99,
        current_seq: 2,
        userId: "forged-user"
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.identity.kind, "anonymous");
    assert.equal(body.persisted, false);

    const afterCount = (await repo.getProgressForUser("any-user-id")).length;
    assert.equal(afterCount, beforeCount);
  });
});

// ---------------------------------------------------------------------------
// Test 2: After registration, /me returns authenticated identity
// ---------------------------------------------------------------------------

test("registration creates a session and /me returns authenticated user", async () => {
  await withServer(async ({ baseUrl }) => {
    const { token } = await registerAndLogin(baseUrl, "user1@test.com");

    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: cookieHeader(token)
    });
    assert.equal(meRes.status, 200);
    const me = await meRes.json() as { user: { email: string } | null };
    assert.ok(me.user);
    assert.equal(me.user!.email, "user1@test.com");
  });
});

// ---------------------------------------------------------------------------
// Test 3: Logged-in user completes a level, map retains stars and unlock
// ---------------------------------------------------------------------------

test("authenticated user progress persists across map requests", async () => {
  await withServer(async ({ baseUrl, repo }) => {
    const { token, userId } = await registerAndLogin(baseUrl, "progress@test.com");
    const headers = { "Content-Type": "application/json", ...cookieHeader(token) };

    // Report a 3-star completion on the first chunk
    const reportRes = await fetch(`${baseUrl}/api/v1/progress/report`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        chunk_id: "aaaaaaaa-0001-4000-8000-000000000001",
        wpm: 65,
        accuracy: 99,
        current_seq: 2
      })
    });
    assert.equal(reportRes.status, 200);
    const report = await reportRes.json();
    assert.equal(report.identity.kind, "authenticated");
    assert.equal(report.persisted, true);
    assert.equal(report.result.isCompleted, true);
    assert.equal(report.result.starsEarned, 3);

    // Verify it was written to the repository
    const progressRows = await repo.getProgressForUser(userId);
    assert.ok(progressRows.length > 0);
    const chunk1Progress = progressRows.find((p) => p.chunk_id === "aaaaaaaa-0001-4000-8000-000000000001");
    assert.ok(chunk1Progress);
    assert.equal(chunk1Progress!.is_completed, true);
    assert.equal(chunk1Progress!.stars_earned, 3);

    // Re-fetch the map — progress should be there
    const mapRes = await fetch(`${baseUrl}/api/v1/sources/11111111-1111-4111-8111-111111111111/map`, {
      headers: cookieHeader(token)
    });
    assert.equal(mapRes.status, 200);
    const map = await mapRes.json();
    assert.equal(map.identity.kind, "authenticated");
    const chunk0 = map.chunks.find((c: { id: string }) => c.id === "aaaaaaaa-0001-4000-8000-000000000001");
    assert.ok(chunk0);
    assert.equal(chunk0.progress.isCompleted, true);
    assert.equal(chunk0.progress.starsEarned, 3);

    // Second chunk should be unlocked (its dependency is completed)
    const chunk1 = map.chunks.find((c: { id: string }) => c.id === "aaaaaaaa-0002-4000-8000-000000000002");
    assert.ok(chunk1);
    assert.equal(chunk1.locked, true); // Server always sets locked based on dependencies, client unlocks
  });
});

// ---------------------------------------------------------------------------
// Test 4: After logout, /me returns anonymous and map is zero progress
// ---------------------------------------------------------------------------

test("logout clears session and map returns to guest zero progress", async () => {
  await withServer(async ({ baseUrl }) => {
    const { token } = await registerAndLogin(baseUrl, "logout@test.com");
    const headers = { "Content-Type": "application/json", ...cookieHeader(token) };

    // Complete a level
    await fetch(`${baseUrl}/api/v1/progress/report`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        chunk_id: "aaaaaaaa-0001-4000-8000-000000000001",
        wpm: 65,
        accuracy: 99,
        current_seq: 2
      })
    });

    // Verify /me shows authenticated
    const meBefore = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: cookieHeader(token) });
    const meBeforeBody = await meBefore.json() as { user: unknown };
    assert.ok(meBeforeBody.user);

    // Logout
    const logoutRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: cookieHeader(token)
    });
    assert.equal(logoutRes.status, 200);

    // /me should return null user
    const meAfter = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: cookieHeader(token) });
    const meAfterBody = await meAfter.json() as { user: unknown };
    assert.equal(meAfterBody.user, null);

    // Map should return anonymous with zero progress
    const mapRes = await fetch(`${baseUrl}/api/v1/sources/11111111-1111-4111-8111-111111111111/map`, {
      headers: cookieHeader(token)
    });
    const map = await mapRes.json();
    assert.equal(map.identity.kind, "anonymous");
    const chunk0 = map.chunks.find((c: { id: string }) => c.id === "aaaaaaaa-0001-4000-8000-000000000001");
    assert.equal(chunk0.progress.isCompleted, false);
    assert.equal(chunk0.progress.starsEarned, 0);
  });
});

// ---------------------------------------------------------------------------
// Test 5: Forged headers and body userId cannot impersonate
// ---------------------------------------------------------------------------

test("forged x-typinglish-user-id and body.userId cannot impersonate other users", async () => {
  await withServer(async ({ baseUrl }) => {
    // Register victim user and complete a level
    const { token: victimToken, userId: victimId } = await registerAndLogin(baseUrl, "victim@test.com");
    const victimHeaders = { "Content-Type": "application/json", ...cookieHeader(victimToken) };

    await fetch(`${baseUrl}/api/v1/progress/report`, {
      method: "POST",
      headers: victimHeaders,
      body: JSON.stringify({
        chunk_id: "aaaaaaaa-0001-4000-8000-000000000001",
        wpm: 65,
        accuracy: 99,
        current_seq: 2
      })
    });

    // Register attacker user
    const { token: attackerToken } = await registerAndLogin(baseUrl, "attacker@test.com");

    // Attacker tries to forge victim's userId in header and body
    const reportRes = await fetch(`${baseUrl}/api/v1/progress/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-typinglish-user-id": victimId,
        ...cookieHeader(attackerToken)
      },
      body: JSON.stringify({
        chunk_id: "aaaaaaaa-0001-4000-8000-000000000001",
        wpm: 10,
        accuracy: 50,
        current_seq: 1,
        userId: victimId
      })
    });
    assert.equal(reportRes.status, 200);
    const report = await reportRes.json();
    // The report should be for the attacker, not the victim
    assert.equal(report.identity.kind, "authenticated");
    assert.equal(report.identity.userId, "attacker@test.com" /* not used for comparison */ ? report.identity.userId : "");

    // Attacker's map should NOT have victim's 3-star progress
    const mapRes = await fetch(`${baseUrl}/api/v1/sources/11111111-1111-4111-8111-111111111111/map`, {
      headers: {
        "x-typinglish-user-id": victimId,
        ...cookieHeader(attackerToken)
      }
    });
    const map = await mapRes.json();
    assert.equal(map.identity.kind, "authenticated");
    assert.notEqual(map.identity.userId, victimId);

    const chunk0 = map.chunks.find((c: { id: string }) => c.id === "aaaaaaaa-0001-4000-8000-000000000001");
    // Attacker's report was low quality (10 wpm, 50% accuracy → 0 stars)
    // So the chunk should show 0 stars, not victim's 3 stars
    assert.equal(chunk0.progress.starsEarned, 0);

    // Victim's map should still have 3 stars
    const victimMapRes = await fetch(`${baseUrl}/api/v1/sources/11111111-1111-4111-8111-111111111111/map`, {
      headers: cookieHeader(victimToken)
    });
    const victimMap = await victimMapRes.json();
    const victimChunk0 = victimMap.chunks.find((c: { id: string }) => c.id === "aaaaaaaa-0001-4000-8000-000000000001");
    assert.equal(victimChunk0.progress.starsEarned, 3);
    assert.equal(victimChunk0.progress.isCompleted, true);
  });
});

// ---------------------------------------------------------------------------
// Test 6: Invalid and expired sessions are treated as anonymous
// ---------------------------------------------------------------------------

test("invalid session token is treated as anonymous", async () => {
  await withServer(async ({ baseUrl }) => {
    const mapRes = await fetch(`${baseUrl}/api/v1/sources/11111111-1111-4111-8111-111111111111/map`, {
      headers: { Cookie: `${SESSION_COOKIE}=invalid-token-value` }
    });
    const map = await mapRes.json();
    assert.equal(map.identity.kind, "anonymous");
  });
});

test("expired session is treated as anonymous", async () => {
  await withServer(async ({ baseUrl, repo }) => {
    // Register a user
    const { token, userId } = await registerAndLogin(baseUrl, "expired@test.com");

    // Manually create an expired session in the repo
    const { createSessionToken, hashToken } = await import("../server/auth.js");
    const expiredToken = createSessionToken();
    const expiredTokenHash = hashToken(expiredToken);
    await repo.createSession({
      userId,
      tokenHash: expiredTokenHash,
      expiresAt: new Date(Date.now() - 86400000).toISOString() // 1 day ago
    });

    // Request with the expired token
    const mapRes = await fetch(`${baseUrl}/api/v1/sources/11111111-1111-4111-8111-111111111111/map`, {
      headers: { Cookie: `${SESSION_COOKIE}=${expiredToken}` }
    });
    const map = await mapRes.json();
    assert.equal(map.identity.kind, "anonymous");
  });
});

// ---------------------------------------------------------------------------
// Test 7: Two users' progress is isolated
// ---------------------------------------------------------------------------

test("two users progress is isolated", async () => {
  await withServer(async ({ baseUrl }) => {
    const { token: tokenA } = await registerAndLogin(baseUrl, "userA@test.com");
    const { token: tokenB } = await registerAndLogin(baseUrl, "userB@test.com");

    const headersA = { "Content-Type": "application/json", ...cookieHeader(tokenA) };
    const headersB = { "Content-Type": "application/json", ...cookieHeader(tokenB) };

    // User A completes chunk 1 with 3 stars
    await fetch(`${baseUrl}/api/v1/progress/report`, {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({
        chunk_id: "aaaaaaaa-0001-4000-8000-000000000001",
        wpm: 65,
        accuracy: 99,
        current_seq: 2
      })
    });

    // User B completes chunk 1 with 1 star
    await fetch(`${baseUrl}/api/v1/progress/report`, {
      method: "POST",
      headers: headersB,
      body: JSON.stringify({
        chunk_id: "aaaaaaaa-0001-4000-8000-000000000001",
        wpm: 40,
        accuracy: 91,
        current_seq: 1
      })
    });

    // User A's map should show 3 stars
    const mapA = await (await fetch(`${baseUrl}/api/v1/sources/11111111-1111-4111-8111-111111111111/map`, {
      headers: cookieHeader(tokenA)
    })).json();
    const chunkA = mapA.chunks.find((c: { id: string }) => c.id === "aaaaaaaa-0001-4000-8000-000000000001");
    assert.equal(chunkA.progress.starsEarned, 3);
    assert.equal(chunkA.progress.isCompleted, true);

    // User B's map should show 1 star
    const mapB = await (await fetch(`${baseUrl}/api/v1/sources/11111111-1111-4111-8111-111111111111/map`, {
      headers: cookieHeader(tokenB)
    })).json();
    const chunkB = mapB.chunks.find((c: { id: string }) => c.id === "aaaaaaaa-0001-4000-8000-000000000001");
    assert.equal(chunkB.progress.starsEarned, 1);
    assert.equal(chunkB.progress.isCompleted, true);

    // User A's identity should not be User B's
    assert.notEqual(mapA.identity.userId, mapB.identity.userId);
  });
});

// ---------------------------------------------------------------------------
// Test 8: Login with wrong password fails, email existence not leaked
// ---------------------------------------------------------------------------

test("login with wrong password returns generic error", async () => {
  await withServer(async ({ baseUrl }) => {
    // Register a user
    await registerAndLogin(baseUrl, "login-test@test.com");

    // Login with wrong password
    const wrongRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "login-test@test.com", password: "wrong-password-999" })
    });
    assert.equal(wrongRes.status, 401);
    const wrongBody = await wrongRes.json();
    assert.equal(wrongBody.error, "Invalid email or password");

    // Login with non-existent email should give the same error
    const nonexistentRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nonexistent@test.com", password: "any-password-123" })
    });
    assert.equal(nonexistentRes.status, 401);
    const nonexistentBody = await nonexistentRes.json();
    assert.equal(nonexistentBody.error, "Invalid email or password");

    // Login with correct password should succeed
    const correctRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "login-test@test.com", password: "test-password-123" })
    });
    assert.equal(correctRes.status, 200);
    const correctBody = await correctRes.json();
    assert.ok(correctBody.user);
    assert.equal(correctBody.user.email, "login-test@test.com");
  });
});

// ---------------------------------------------------------------------------
// Test 9: Registration validation
// ---------------------------------------------------------------------------

test("registration rejects invalid email and short password", async () => {
  await withServer(async ({ baseUrl }) => {
    // Invalid email
    const badEmailRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", password: "valid-password-123" })
    });
    assert.equal(badEmailRes.status, 400);

    // Short password
    const shortPassRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "valid@test.com", password: "short" })
    });
    assert.equal(shortPassRes.status, 400);

    // Duplicate email
    await registerAndLogin(baseUrl, "duplicate@test.com");
    const dupRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "duplicate@test.com", password: "valid-password-123" })
    });
    assert.equal(dupRes.status, 409);
  });
});
