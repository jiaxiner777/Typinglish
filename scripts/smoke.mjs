import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function childEnv() {
  const env = { ...process.env };
  if (process.platform === "win32" && env.PATH && env.Path) {
    delete env.Path;
  }
  return env;
}

const children = [
  spawn(npmCommand, ["run", "api"], { cwd: process.cwd(), env: childEnv(), shell: process.platform === "win32", stdio: "pipe" }),
  spawn(npmCommand, ["run", "dev", "--", "--port", "5173"], {
    cwd: process.cwd(),
    env: childEnv(),
    shell: process.platform === "win32",
    stdio: "pipe"
  })
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function get(url) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(url);
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

try {
  const health = await (await get("http://127.0.0.1:4177/api/v1/health")).json();
  const html = await (await get("http://127.0.0.1:5173")).text();
  const sources = await (await get("http://127.0.0.1:4177/api/v1/sources")).json();
  const map = await (await get(`http://127.0.0.1:4177/api/v1/sources/${sources[0].id}/map`)).json();
  const stream = await (await get(`http://127.0.0.1:4177/api/v1/chunks/${map.chunks[0].id}/stream`)).json();

  console.log(
    JSON.stringify(
      {
        health,
        frontendHtml: html.includes('id="root"'),
        sources: sources.length,
        mapChunks: map.chunks.length,
        streamNodes: stream.nodes.length
      },
      null,
      2
    )
  );
} finally {
  stopChildren();
}

setTimeout(() => process.exit(0), 250);
