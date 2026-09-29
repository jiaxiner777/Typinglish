import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { bootstrapDatabase } from "../bootstrap.js";
import { readEnv } from "../config/env.js";

async function main() {
  const env = readEnv();
  if (!env.databaseUrl) throw new Error("DATABASE_URL is required for database initialization.");
  const schema = await readFile(resolve(process.cwd(), "db/schema.sql"), "utf8");
  const pool = new pg.Pool({ connectionString: env.databaseUrl, max: 1, connectionTimeoutMillis: 15_000 });
  try {
    const client = await pool.connect();
    try {
      const result = await bootstrapDatabase(client, schema);
      console.log(result.seeded ? "Database ready; initial practice content imported." : "Database ready; existing content and user progress preserved.");
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  // Never dump connection objects or credentials into deployment logs.
  console.error("Database initialization failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
