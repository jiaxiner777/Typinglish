import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { bootstrapDatabase, type BootstrapClient } from "../server/bootstrap.js";
import { chunks, contentNodes, sources } from "../server/seed.js";

function clientFor(db: PGlite): BootstrapClient {
  return {
    async query(sql, values) {
      if (values) return db.query<Record<string, unknown>>(sql, values);
      const results = await db.exec(sql);
      return { rows: (results.at(-1)?.rows ?? []) as Record<string, unknown>[] };
    }
  };
}

test("database bootstrap imports content once and preserves owner edits and real user progress", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  try {
    const client = clientFor(db);
    assert.equal((await bootstrapDatabase(client, schema)).seeded, true);
    for (const [table, count] of [["sources", sources.length], ["chunks", chunks.length], ["content_nodes", contentNodes.length], ["users", 0], ["user_progress", 0]] as const) {
      const result = await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM ${table}`);
      assert.equal(result.rows[0].count, count, table);
    }
    const original = contentNodes[0];
    await db.query("UPDATE content_nodes SET raw_text = $1 WHERE id = $2", ["Owner-edited practice sentence.", original.id]);
    await db.query("UPDATE sources SET status = 'archived' WHERE id = $1", [sources[0].id]);
    // Deleting content deliberately must not cause it to reappear on restart.
    await db.query("DELETE FROM content_nodes WHERE id = $1", [contentNodes.at(-1)!.id]);
    const user = await db.query<{ id: string }>("INSERT INTO users (email, password_hash) VALUES ('real-user@example.test', 'test-hash') RETURNING id");
    await db.query("INSERT INTO user_progress (user_id, chunk_id, stars_earned, is_completed) VALUES ($1, $2, 2, true)", [user.rows[0].id, chunks[0].id]);
    assert.equal((await bootstrapDatabase(client, schema)).seeded, false);
    assert.equal((await db.query<{ raw_text: string }>("SELECT raw_text FROM content_nodes WHERE id = $1", [original.id])).rows[0].raw_text, "Owner-edited practice sentence.");
    assert.equal((await db.query<{ status: string }>("SELECT status FROM sources WHERE id = $1", [sources[0].id])).rows[0].status, "archived");
    assert.equal((await db.query<{ count: number }>("SELECT count(*)::int AS count FROM content_nodes")).rows[0].count, contentNodes.length - 1);
    assert.equal((await db.query<{ stars_earned: number }>("SELECT stars_earned FROM user_progress WHERE user_id = $1", [user.rows[0].id])).rows[0].stars_earned, 2);
  } finally {
    await db.close();
  }
});

test("a failed initial import rolls back and can be retried", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  try {
    const client = clientFor(db);
    const failing: BootstrapClient = {
      async query(sql, values) {
        if (sql.includes("INSERT INTO content_nodes")) throw new Error("Interrupted import");
        return client.query(sql, values);
      }
    };
    await assert.rejects(bootstrapDatabase(failing, schema), /Interrupted import/);
    const rolledBack = await db.query<{ table_name: string | null }>("SELECT to_regclass('sources')::text AS table_name");
    assert.equal(rolledBack.rows[0].table_name, null);
    assert.equal((await bootstrapDatabase(client, schema)).seeded, true);
  } finally {
    await db.close();
  }
});
