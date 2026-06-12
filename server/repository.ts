import pg from "pg";
import { chunks, contentNodes, demoUserId, progressRows, sources } from "./seed";
import type { ChunkRow, ContentNodeRow, SourceRow, SourceType, UserProgressRow } from "./types";

const { Pool } = pg;

export interface Repository {
  getSources(type?: SourceType): Promise<SourceRow[]>;
  getChunksForSource(sourceId: string): Promise<ChunkRow[]>;
  getNodesForChunk(chunkId: string, cursorSeq: number, limit: number): Promise<ContentNodeRow[]>;
  getProgressForUser(userId: string): Promise<UserProgressRow[]>;
  reportProgress(input: {
    userId: string;
    chunkId: string;
    wpm: number;
    accuracy: number;
    currentSeq: number;
  }): Promise<UserProgressRow>;
}

function calculateStars(wpm: number, accuracy: number) {
  if (accuracy >= 98 && wpm >= 60) return 3;
  if (accuracy >= 95) return 2;
  if (accuracy >= 90) return 1;
  return 0;
}

function uuidFromChunkId(chunkId: string) {
  const normalized = chunkId.replace(/[^a-fA-F0-9]/g, "").slice(0, 12).padEnd(12, "0");
  return `eeeeeeee-${normalized.slice(0, 4)}-4${normalized.slice(4, 7)}-8${normalized.slice(7, 10)}-${normalized.slice(0, 12)}`;
}

class MemoryRepository implements Repository {
  private progress = [...progressRows];

  async getSources(type?: SourceType) {
    return sources.filter((source) => source.is_active && (!type || source.type === type));
  }

  async getChunksForSource(sourceId: string) {
    return chunks
      .filter((chunk) => chunk.source_id === sourceId)
      .sort((a, b) => a.chapter_num - b.chapter_num || a.section_num - b.section_num);
  }

  async getNodesForChunk(chunkId: string, cursorSeq: number, limit: number) {
    return contentNodes
      .filter((node) => node.chunk_id === chunkId && node.sequence >= cursorSeq)
      .sort((a, b) => a.sequence - b.sequence)
      .slice(0, limit);
  }

  async getProgressForUser(userId: string) {
    return this.progress.filter((row) => row.user_id === userId);
  }

  async reportProgress(input: { userId: string; chunkId: string; wpm: number; accuracy: number; currentSeq: number }) {
    const existing = this.progress.find((row) => row.user_id === input.userId && row.chunk_id === input.chunkId);
    const stars = calculateStars(input.wpm, input.accuracy);
    const now = new Date().toISOString();

    if (!existing) {
      const created: UserProgressRow = {
        id: uuidFromChunkId(input.chunkId),
        user_id: input.userId,
        chunk_id: input.chunkId,
        highest_wpm: input.wpm,
        highest_accuracy: input.accuracy,
        stars_earned: stars,
        last_node_sequence: Math.max(1, input.currentSeq),
        is_completed: stars > 0,
        updated_at: now
      };
      this.progress.push(created);
      return created;
    }

    existing.highest_wpm = Math.max(existing.highest_wpm, input.wpm);
    existing.highest_accuracy = Math.max(existing.highest_accuracy, input.accuracy);
    existing.stars_earned = Math.max(existing.stars_earned, stars);
    existing.last_node_sequence = Math.max(1, input.currentSeq);
    existing.is_completed = existing.is_completed || stars > 0;
    existing.updated_at = now;
    return existing;
  }
}

class PostgresRepository implements Repository {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async getSources(type?: SourceType) {
    const result = type
      ? await this.pool.query<SourceRow>("SELECT * FROM sources WHERE is_active = true AND type = $1 ORDER BY created_at DESC", [type])
      : await this.pool.query<SourceRow>("SELECT * FROM sources WHERE is_active = true ORDER BY created_at DESC");
    return result.rows;
  }

  async getChunksForSource(sourceId: string) {
    const result = await this.pool.query<ChunkRow>(
      "SELECT * FROM chunks WHERE source_id = $1 ORDER BY chapter_num, section_num",
      [sourceId]
    );
    return result.rows;
  }

  async getNodesForChunk(chunkId: string, cursorSeq: number, limit: number) {
    const result = await this.pool.query<ContentNodeRow>(
      "SELECT * FROM content_nodes WHERE chunk_id = $1 AND sequence >= $2 ORDER BY sequence LIMIT $3",
      [chunkId, cursorSeq, limit]
    );
    return result.rows;
  }

  async getProgressForUser(userId: string) {
    const result = await this.pool.query<UserProgressRow>("SELECT * FROM user_progress WHERE user_id = $1", [userId]);
    return result.rows;
  }

  async reportProgress(input: { userId: string; chunkId: string; wpm: number; accuracy: number; currentSeq: number }) {
    const stars = calculateStars(input.wpm, input.accuracy);
    const result = await this.pool.query<UserProgressRow>(
      `
      INSERT INTO user_progress (
        user_id, chunk_id, highest_wpm, highest_accuracy, stars_earned, last_node_sequence, is_completed, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, chunk_id) DO UPDATE SET
        highest_wpm = GREATEST(user_progress.highest_wpm, EXCLUDED.highest_wpm),
        highest_accuracy = GREATEST(user_progress.highest_accuracy, EXCLUDED.highest_accuracy),
        stars_earned = GREATEST(user_progress.stars_earned, EXCLUDED.stars_earned),
        last_node_sequence = EXCLUDED.last_node_sequence,
        is_completed = user_progress.is_completed OR EXCLUDED.is_completed,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
      `,
      [input.userId, input.chunkId, input.wpm, input.accuracy, stars, Math.max(1, input.currentSeq), stars > 0]
    );
    return result.rows[0];
  }
}

export function createRepository(): Repository {
  if (process.env.DATABASE_URL) {
    return new PostgresRepository(process.env.DATABASE_URL);
  }
  return new MemoryRepository();
}

export { calculateStars, demoUserId };
