import pg from "pg";
import { chunks, contentNodes, demoUserId, progressRows, sources } from "../seed.js";

const { Pool } = pg;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for seed-demo.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
      INSERT INTO users (id, display_name, provider, provider_user_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        provider = EXCLUDED.provider,
        provider_user_id = EXCLUDED.provider_user_id,
        updated_at = CURRENT_TIMESTAMP
      `,
      [demoUserId, "Demo User", "demo", demoUserId]
    );

    for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
      const source = sources[sourceIndex];
      await client.query(
        `
        INSERT INTO sources (id, slug, title, type, cover_url, is_active, status, sort_order, metadata, created_at, updated_at, published_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'published', $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          slug = EXCLUDED.slug,
          title = EXCLUDED.title,
          type = EXCLUDED.type,
          cover_url = EXCLUDED.cover_url,
          is_active = EXCLUDED.is_active,
          status = 'published',
          sort_order = EXCLUDED.sort_order,
          metadata = EXCLUDED.metadata,
          updated_at = CURRENT_TIMESTAMP,
          published_at = COALESCE(sources.published_at, CURRENT_TIMESTAMP)
        `,
        [source.id, source.slug ?? null, source.title, source.type, source.cover_url, source.is_active, sourceIndex, source.metadata, source.created_at]
      );
    }

    for (const chunk of chunks) {
      await client.query(
        `
        INSERT INTO chunks (id, source_id, chapter_num, section_num, title, summary, dependencies, map_zone, map_pos_x, map_pos_y, word_count, metadata, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8, $9, $10, '{}'::jsonb, $11, CURRENT_TIMESTAMP)
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
          updated_at = CURRENT_TIMESTAMP
        `,
        [chunk.id, chunk.source_id, chunk.chapter_num, chunk.section_num, chunk.title, chunk.dependencies, chunk.map_zone, chunk.map_pos_x, chunk.map_pos_y, chunk.word_count, chunk.created_at]
      );
    }

    for (const node of contentNodes) {
      await client.query(
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
        `,
        [node.id, node.chunk_id, node.sequence, node.raw_text, node.clean_text, node.translation ?? null, node.audio_url ?? null]
      );
    }

    for (const progress of progressRows) {
      await client.query(
        `
        INSERT INTO user_progress (id, user_id, chunk_id, highest_wpm, highest_accuracy, stars_earned, last_node_sequence, is_completed, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, chunk_id) DO UPDATE SET
          highest_wpm = GREATEST(user_progress.highest_wpm, EXCLUDED.highest_wpm),
          highest_accuracy = GREATEST(user_progress.highest_accuracy, EXCLUDED.highest_accuracy),
          stars_earned = GREATEST(user_progress.stars_earned, EXCLUDED.stars_earned),
          last_node_sequence = GREATEST(user_progress.last_node_sequence, EXCLUDED.last_node_sequence),
          is_completed = user_progress.is_completed OR EXCLUDED.is_completed,
          updated_at = CURRENT_TIMESTAMP
        `,
        [progress.id, progress.user_id, progress.chunk_id, progress.highest_wpm, progress.highest_accuracy, progress.stars_earned, progress.last_node_sequence, progress.is_completed]
      );
    }

    await client.query("COMMIT");
    console.log(`Seeded ${sources.length} sources, ${chunks.length} chunks, and ${contentNodes.length} nodes into PostgreSQL.`);
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
