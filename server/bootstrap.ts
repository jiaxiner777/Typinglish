import { chunks, contentNodes, sources } from "./seed.js";

export interface BootstrapClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

/** Initializes a new deployment without overwriting edits or adding fake users. */
export async function bootstrapDatabase(client: BootstrapClient, schema: string) {
  await client.query("BEGIN");
  try {
    // Serializes concurrent starts on the same database.
    await client.query("SELECT pg_advisory_xact_lock(83971423)");
    await client.query(schema);
    await client.query(`CREATE TABLE IF NOT EXISTS app_bootstrap_runs (
      name TEXT PRIMARY KEY,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const existing = await client.query("SELECT name FROM app_bootstrap_runs WHERE name = $1", ["initial-content-v1"]);
    let seeded = false;
    if (existing.rows.length === 0) {
      for (const [index, source] of sources.entries()) {
        await client.query(`INSERT INTO sources
          (id, slug, title, type, cover_url, is_active, status, sort_order, metadata, published_at)
          VALUES ($1, $2, $3, $4, $5, $6, 'published', $7, $8, CURRENT_TIMESTAMP)
          ON CONFLICT DO NOTHING`,
        [source.id, source.slug ?? null, source.title, source.type, source.cover_url, source.is_active, index, source.metadata]);
      }
      for (const chunk of chunks) {
        await client.query(`INSERT INTO chunks
          (id, source_id, chapter_num, section_num, title, summary, dependencies, map_zone, map_pos_x, map_pos_y, word_count, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT DO NOTHING`,
        [chunk.id, chunk.source_id, chunk.chapter_num, chunk.section_num, chunk.title, chunk.summary ?? null,
          chunk.dependencies, chunk.map_zone, chunk.map_pos_x, chunk.map_pos_y, chunk.word_count, chunk.metadata ?? {}]);
      }
      for (const node of contentNodes) {
        await client.query(`INSERT INTO content_nodes
          (id, chunk_id, sequence, raw_text, clean_text, translation, audio_url, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT DO NOTHING`,
        [node.id, node.chunk_id, node.sequence, node.raw_text, node.clean_text, node.translation ?? null, node.audio_url ?? null, node.notes ?? null]);
      }
      await client.query("INSERT INTO app_bootstrap_runs (name) VALUES ($1)", ["initial-content-v1"]);
      seeded = true;
    }
    await client.query("COMMIT");
    return { seeded };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
