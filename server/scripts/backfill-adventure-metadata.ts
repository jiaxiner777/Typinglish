import pg from "pg";
import { chunks, contentNodes, sources } from "../seed.js";

const { Pool } = pg;

/**
 * Idempotent backfill for Geek Typing Core demo chunks.
 *
 * - Upserts chunk rows (metadata, dependencies, title, word_count, map_zone, etc.)
 * - Upserts content_nodes for those chunks
 * - Inserts missing demo chunks that don't yet exist in the DB
 * - Does NOT touch: users, sessions, user_progress, or non-demo content
 * - Idempotent: ON CONFLICT DO UPDATE ... WHERE IS DISTINCT FROM ensures
 *   re-running produces zero changes when data is already current
 */
const GEEK_SOURCE_ID = sources[1].id; // "22222222-2222-4222-8222-222222222222"

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for the Adventure metadata backfill.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Filter to only Geek Typing Core demo chunks and their content nodes
    const geekChunks = chunks.filter((c) => c.source_id === GEEK_SOURCE_ID);
    const geekChunkIds = new Set(geekChunks.map((c) => c.id));
    const geekNodes = contentNodes.filter((n) => geekChunkIds.has(n.chunk_id));

    let chunksInserted = 0;
    let chunksUpdated = 0;
    let nodesInserted = 0;
    let nodesUpdated = 0;

    // ── Upsert Geek Typing Core chunks ──────────────────────────────
    for (const chunk of geekChunks) {
      // Detect insert vs update for accurate reporting
      const existing = await client.query(
        `SELECT 1 FROM chunks WHERE id = $1 AND source_id = $2`,
        [chunk.id, chunk.source_id]
      );
      const isNew = existing.rowCount === 0;

      const result = await client.query(
        `
        INSERT INTO chunks (id, source_id, chapter_num, section_num, title, summary, dependencies, map_zone, map_pos_x, map_pos_y, word_count, metadata, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          source_id = EXCLUDED.source_id,
          chapter_num = EXCLUDED.chapter_num,
          section_num = EXCLUDED.section_num,
          title = EXCLUDED.title,
          dependencies = EXCLUDED.dependencies,
          map_zone = EXCLUDED.map_zone,
          map_pos_x = EXCLUDED.map_pos_x,
          map_pos_y = EXCLUDED.map_pos_y,
          word_count = EXCLUDED.word_count,
          metadata = EXCLUDED.metadata,
          updated_at = CURRENT_TIMESTAMP
        WHERE
          chunks.source_id  IS DISTINCT FROM EXCLUDED.source_id  OR
          chunks.chapter_num IS DISTINCT FROM EXCLUDED.chapter_num OR
          chunks.section_num IS DISTINCT FROM EXCLUDED.section_num OR
          chunks.title       IS DISTINCT FROM EXCLUDED.title       OR
          chunks.dependencies IS DISTINCT FROM EXCLUDED.dependencies OR
          chunks.map_zone    IS DISTINCT FROM EXCLUDED.map_zone    OR
          chunks.map_pos_x   IS DISTINCT FROM EXCLUDED.map_pos_x   OR
          chunks.map_pos_y   IS DISTINCT FROM EXCLUDED.map_pos_y   OR
          chunks.word_count  IS DISTINCT FROM EXCLUDED.word_count  OR
          chunks.metadata    IS DISTINCT FROM EXCLUDED.metadata
        `,
        [
          chunk.id,
          chunk.source_id,
          chunk.chapter_num,
          chunk.section_num,
          chunk.title,
          chunk.dependencies,
          chunk.map_zone,
          chunk.map_pos_x,
          chunk.map_pos_y,
          chunk.word_count,
          chunk.metadata ?? {},
          chunk.created_at
        ]
      );

      if (isNew) {
        chunksInserted++;
      } else if ((result.rowCount ?? 0) > 0) {
        chunksUpdated++;
      }
    }

    // ── Upsert content nodes for Geek Typing Core chunks ───────────
    for (const node of geekNodes) {
      const existing = await client.query(
        `SELECT 1 FROM content_nodes WHERE id = $1 AND chunk_id = $2`,
        [node.id, node.chunk_id]
      );
      const isNew = existing.rowCount === 0;

      const result = await client.query(
        `
        INSERT INTO content_nodes (id, chunk_id, sequence, raw_text, clean_text, translation, audio_url, notes, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          chunk_id = EXCLUDED.chunk_id,
          sequence = EXCLUDED.sequence,
          raw_text = EXCLUDED.raw_text,
          clean_text = EXCLUDED.clean_text,
          translation = EXCLUDED.translation,
          audio_url = EXCLUDED.audio_url,
          updated_at = CURRENT_TIMESTAMP
        WHERE
          content_nodes.chunk_id   IS DISTINCT FROM EXCLUDED.chunk_id   OR
          content_nodes.sequence   IS DISTINCT FROM EXCLUDED.sequence   OR
          content_nodes.raw_text   IS DISTINCT FROM EXCLUDED.raw_text   OR
          content_nodes.clean_text IS DISTINCT FROM EXCLUDED.clean_text OR
          content_nodes.translation IS DISTINCT FROM EXCLUDED.translation OR
          content_nodes.audio_url  IS DISTINCT FROM EXCLUDED.audio_url
        `,
        [node.id, node.chunk_id, node.sequence, node.raw_text, node.clean_text, node.translation ?? null, node.audio_url ?? null]
      );

      if (isNew) {
        nodesInserted++;
      } else if ((result.rowCount ?? 0) > 0) {
        nodesUpdated++;
      }
    }

    await client.query("COMMIT");
    const chunksUnchanged = geekChunks.length - chunksInserted - chunksUpdated;
    const nodesUnchanged = geekNodes.length - nodesInserted - nodesUpdated;
    console.log(`Backfill complete for Geek Typing Core (source: ${GEEK_SOURCE_ID}):`);
    console.log(`  Chunks:        ${chunksInserted} inserted, ${chunksUpdated} updated, ${chunksUnchanged} unchanged (${geekChunks.length} total)`);
    console.log(`  Content nodes: ${nodesInserted} inserted, ${nodesUpdated} updated, ${nodesUnchanged} unchanged (${geekNodes.length} total)`);
    console.log(`  Safety: users, sessions, user_progress, and non-demo content were not touched.`);
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
