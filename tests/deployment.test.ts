import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../server/app/createApp.js";
import { readEnv, type AppEnv } from "../server/config/env.js";
import { createRepository } from "../server/repository.js";

const secret = "test-only-owner-key-with-at-least-32-characters";
const env: AppEnv = { port: 0, databaseUrl: null, nodeEnv: "production", corsOrigins: [], adminToken: secret, cookieSecure: true };

test("production serves web and API on one origin and protects all admin operations", async () => {
  const directory = await mkdtemp(join(tmpdir(), "typinglish-deployment-"));
  await writeFile(join(directory, "index.html"), '<html><div id="root">test-web-app</div></html>');
  await writeFile(join(directory, "app.js"), "console.log('test asset');");
  const server = createApp(env, createRepository(), { staticDirectory: directory }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    for (const path of ["/", "/admin", "/admin/"]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200);
      assert.match(await response.text(), /test-web-app/);
      assert.equal(response.headers.get("cache-control"), "no-cache");
    }
    assert.match(await (await fetch(base + "/app.js")).text(), /test asset/);
    const missing = await fetch(base + "/api/not-a-route");
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get("content-type")!, /application\/json/);

    const registration = await fetch(base + "/api/v1/auth/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "beta-user@example.test", password: "ordinary-user-password" })
    });
    assert.equal(registration.status, 201);
    const session = registration.headers.get("set-cookie")!;
    assert.match(session, /HttpOnly/);
    assert.match(session, /Secure/);
    const cookie = session.split(";")[0];

    for (const headers of [{}, { "x-admin-token": "wrong" }, { Cookie: cookie }]) {
      for (const [path, method] of [["/sources", "GET"], ["/sources", "POST"], ["/sources/anything", "PATCH"], ["/chunks/anything", "DELETE"]]) {
        const response = await fetch(base + "/api/admin/v1" + path, { method, headers });
        assert.equal(response.status, 401, `${method} ${path} must require the owner key`);
      }
    }
    const owner = await fetch(base + "/api/admin/v1/sources", { headers: { "x-admin-token": secret } });
    assert.equal(owner.status, 200);
    const items = await owner.json() as { id: string }[];
    const edit = await fetch(base + `/api/admin/v1/sources/${items[0].id}`, {
      method: "PATCH", headers: { "x-admin-token": secret, "Content-Type": "application/json" }, body: JSON.stringify({ title: "Owner edit" })
    });
    assert.equal(edit.status, 200);
    assert.equal((await edit.json()).title, "Owner edit");
    const outsider = await fetch(base + "/api/v1/sources", { headers: { Origin: "https://unrelated.example" } });
    assert.equal(outsider.headers.get("access-control-allow-origin"), null);
  } finally {
    const closed = once(server, "close");
    server.close();
    await closed;
    await rm(directory, { recursive: true, force: true });
  }
});

test("an unconfigured admin key never opens the admin API", async () => {
  const server = createApp({ ...env, nodeEnv: "test", adminToken: null }, createRepository()).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/v1/sources`);
    assert.equal(response.status, 503);
  } finally {
    const closed = once(server, "close");
    server.close();
    await closed;
  }
});

test("production cannot start without durable storage and a strong owner key", () => {
  const keys = ["NODE_ENV", "DATABASE_URL", "ADMIN_TOKEN"] as const;
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;
    delete process.env.ADMIN_TOKEN;
    assert.throws(readEnv, /DATABASE_URL is required/);
    process.env.DATABASE_URL = "postgres://test:test@localhost/typinglish";
    assert.throws(readEnv, /ADMIN_TOKEN/);
    process.env.ADMIN_TOKEN = "short";
    assert.throws(readEnv, /ADMIN_TOKEN/);
    process.env.ADMIN_TOKEN = secret;
    assert.equal(readEnv().cookieSecure, true);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
