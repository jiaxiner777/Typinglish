import { spawn } from "node:child_process";

const keepAlive = process.argv.includes("--keep-alive");
const apiPort = 4187;
const webPort = 5183;
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
const webBaseUrl = `http://127.0.0.1:${webPort}`;

function childEnv() {
  const env = { ...process.env };
  if (process.platform === "win32" && env.PATH && env.Path) {
    delete env.Path;
  }
  return env;
}

const children = [
  spawn(process.execPath, ["--env-file-if-exists=.env", "--import", "tsx", "server/index.ts"], {
    cwd: process.cwd(),
    env: { ...childEnv(), PORT: String(apiPort) },
    stdio: "pipe"
  }),
  spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(webPort)], {
    cwd: process.cwd(),
    env: { ...childEnv(), VITE_API_BASE_URL: apiBaseUrl },
    stdio: "pipe"
  })
];

for (const child of children) {
  child.stdout?.pipe(process.stdout);
  child.stderr?.pipe(process.stderr);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function get(url) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(800) });
      if (response.ok) return response;
    } catch {
      // Server is still booting.
    }
    await wait(1000);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function stopChildren() {
  for (const child of children) {
    child.stdout?.destroy();
    child.stderr?.destroy();
    child.stdin?.destroy();
    if (!child.killed) child.kill();
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`SMOKE ASSERTION FAILED: ${message}`);
  }
}

try {
  const health = await (await get(`${apiBaseUrl}/api/v1/health`)).json();
  const html = await (await get(webBaseUrl)).text();
  const sources = await (await get(`${apiBaseUrl}/api/v1/sources`)).json();
  const adventureSource = sources.find((source) => source.type === "SERIES");
  assert(adventureSource, "a SERIES Adventure source must exist");
  const map = await (await get(`${apiBaseUrl}/api/v1/sources/${adventureSource.id}/map`)).json();
  const stream = await (await get(`${apiBaseUrl}/api/v1/chunks/${map.chunks[0].id}/stream`)).json();
  const anonymousReport = await fetch(`${apiBaseUrl}/api/v1/progress/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-typinglish-user-id": "forged-user" },
    body: JSON.stringify({
      chunk_id: map.chunks[0].id,
      wpm: 75,
      accuracy: 100,
      error_count: 0,
      elapsed_seconds: 10,
      input_mode: "STRICT",
      completed: true,
      timed_out: false,
      current_seq: 2,
      userId: "forged-user"
    })
  }).then((response) => response.json());
  const mapAfterReport = await (await get(`${apiBaseUrl}/api/v1/sources/${adventureSource.id}/map`)).json();

  // CORS credentials regression: with Origin header, server must echo the origin
  // (not "*") and set Access-Control-Allow-Credentials: true.  This guards
  // against the "Loading / empty map" failure caused by the browser rejecting
  // credentials-mode requests when ACAO is "*".
  const corsRes = await fetch(`${apiBaseUrl}/api/v1/sources`, {
    headers: { Origin: `http://localhost:${webPort}` }
  });
  const corsAllowOrigin = corsRes.headers.get("access-control-allow-origin");
  const corsAllowCredentials = corsRes.headers.get("access-control-allow-credentials");

  // Auth route regression: /api/v1/auth/me must exist and return { user: null }
  // for anonymous requests.  A 404 here means the server is running stale code.
  const meRes = await fetch(`${apiBaseUrl}/api/v1/auth/me`);
  const meBody = await meRes.json();

  const result = {
    health,
    frontendHtml: html.includes('id="root"'),
    sources: sources.length,
    mapChunks: map.chunks.length,
    streamNodes: stream.nodes.length,
    anonymousIdentity: map.identity?.kind,
    anonymousReportPersisted: anonymousReport.persisted,
    anonymousMapUnchanged: mapAfterReport.chunks[0].progress.isCompleted === false,
    corsAllowOrigin,
    corsAllowCredentials,
    authMeStatus: meRes.status,
    authMeUser: meBody.user
  };

  console.log(JSON.stringify(result, null, 2));

  // --- Assertions ---
  // Content must be non-empty (guards against "Loading / 0 of 0 cleared" regression)
  assert(sources.length > 0, "sources array must not be empty (MemoryRepository seed required for local dev)");
  assert(map.chunks.length > 0, "map chunks must not be empty");
  assert(stream.nodes.length > 0, "stream nodes must not be empty");
  // CORS must not return "*" when credentials are enabled
  assert(corsAllowOrigin !== "*", "CORS Access-Control-Allow-Origin must not be '*' (breaks credentials mode)");
  assert(corsAllowCredentials === "true", "CORS Access-Control-Allow-Credentials must be 'true'");
  // Auth route must be mounted (guards against stale-server regression)
  assert(meRes.status === 200, "GET /api/v1/auth/me must return 200, not 404 (stale server code)");
  assert(meBody.user === null, "GET /api/v1/auth/me must return { user: null } for anonymous");

  console.log("\n✓ All smoke assertions passed");
} catch (error) {
  console.error(`\n✗ ${error.message}`);
  process.exitCode = 1;
} finally {
  if (!keepAlive) stopChildren();
}

if (keepAlive) {
  console.log("\nSmoke servers remain available for browser verification.");
} else {
  setTimeout(() => process.exit(process.exitCode || 0), 250);
}
