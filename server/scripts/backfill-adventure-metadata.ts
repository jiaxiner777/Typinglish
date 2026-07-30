import pg from "pg";
import { chunks } from "../seed.js";

const { Pool } = pg;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for the Adventure metadata backfill.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    let updatedCount = 0;

    for (const chunk of chunks) {
      const adventure = chunk.metadata?.adventure;
      if (!adventure) continue;

      const result = await client.query(
        `
        UPDATE chunks
        SET metadata = jsonb_set(
              COALESCE(metadata, '{}'::jsonb),
              '{adventure}',
              $3::jsonb,
              true
            ),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND source_id = $2
          AND (metadata->'adventure') IS DISTINCT FROM $3::jsonb
        `,
        [chunk.id, chunk.source_id, JSON.stringify(adventure)]
      );
      updatedCount += result.rowCount ?? 0;
    }

    await client.query("COMMIT");
    console.log(`Adventure metadata backfill complete: ${updatedCount} demo chunks updated.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
