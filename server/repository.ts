import { randomUUID } from "node:crypto";
import pg from "pg";
import { chunks, contentNodes, demoUserId, progressRows, sources } from "./seed.js";
import type {
  AdminSourceFilters,
  ChunkInput,
  ChunkPatch,
  ChunkRow,
  ContentNodeRow,
  NodeInput,
  NodePatch,
  SessionRow,
  SourceInput,
  SourcePatch,
  SourceRow,
  SourceStatus,
  SourceType,
  UserProgressRow,
  UserRow
} from "./types.js";

const { Pool } = pg;

export type RepositoryMode = "memory" | "postgres";

export interface Repository {
  readonly mode: RepositoryMode;
  ping(): Promise<void>;
  ensureUser(input: {
    id: string;
    email?: string | null;
    displayName?: string | null;
    passwordHash?: string | null;
    provider?: string | null;
    providerUserId?: string | null;
  }): Promise<UserRow>;
  getSources(type?: SourceType): Promise<SourceRow[]>;
  getSourceById(sourceId: string): Promise<SourceRow | null>;
  listAdminSources(filters?: AdminSourceFilters): Promise<SourceRow[]>;
  createSource(input: SourceInput): Promise<SourceRow>;
  updateSource(sourceId: string, patch: SourcePatch): Promise<SourceRow | null>;
  getChunksForSource(sourceId: string): Promise<ChunkRow[]>;
  getChunkById(chunkId: string): Promise<ChunkRow | null>;
  createChunk(input: ChunkInput): Promise<ChunkRow>;
  updateChunk(chunkId: string, patch: ChunkPatch): Promise<ChunkRow | null>;
  deleteChunk(chunkId: string): Promise<boolean>;
  reorderChunks(sourceId: string, orderedChunkIds: string[]): Promise<ChunkRow[]>;
  getNodesForChunk(chunkId: string, cursorSeq: number, limit: number): Promise<ContentNodeRow[]>;
  listNodesForChunk(chunkId: string): Promise<ContentNodeRow[]>;
  createNode(input: NodeInput): Promise<ContentNodeRow>;
  updateNode(nodeId: string, patch: NodePatch): Promise<ContentNodeRow | null>;
  deleteNode(nodeId: string): Promise<boolean>;
  resequenceNodes(chunkId: string, orderedNodeIds: string[]): Promise<ContentNodeRow[]>;
  getProgressForUser(userId: string): Promise<UserProgressRow[]>;
  reportProgress(input: {
    userId: string;
    chunkId: string;
    wpm: number;
    accuracy: number;
    currentSeq: number;
    starsEarned: number;
    passed: boolean;
  }): Promise<UserProgressRow>;
  getUserByEmail(email: string): Promise<UserRow | null>;
  getUserById(userId: string): Promise<UserRow | null>;
  createUser(input: {
    email: string;
    passwordHash: string;
    displayName?: string | null;
  }): Promise<UserRow>;
  createSession(input: {
    userId: string;
    tokenHash: string;
    expiresAt: string;
  }): Promise<SessionRow>;
  getSessionByTokenHash(tokenHash: string): Promise<SessionRow | null>;
  deleteSession(tokenHash: string): Promise<boolean>;
}

function nowIso() {
  return new Date().toISOString();
}

function uuidFromChunkId(chunkId: string) {
  const normalized = chunkId.replace(/[^a-fA-F0-9]/g, "").slice(0, 12).padEnd(12, "0");
  return `eeeeeeee-${normalized.slice(0, 4)}-4${normalized.slice(4, 7)}-8${normalized.slice(7, 10)}-${normalized.slice(0, 12)}`;
}

function computeWordCount(nodes: ContentNodeRow[]) {
  return nodes.reduce((sum, node) => sum + node.raw_text.split(/\s+/).filter(Boolean).length, 0);
}

function applySourceDefaults(source: SourceRow): SourceRow {
  return {
    ...source,
    status: source.status ?? "published",
    sort_order: source.sort_order ?? 0,
    updated_at: source.updated_at ?? source.created_at,
    published_at: source.published_at ?? (source.status === "published" ? source.created_at : null)
  };
}

function applyChunkDefaults(chunk: ChunkRow): ChunkRow {
  return {
    ...chunk,
    summary: chunk.summary ?? null,
    metadata: chunk.metadata ?? {},
    updated_at: chunk.updated_at ?? chunk.created_at
  };
}

function applyNodeDefaults(node: ContentNodeRow): ContentNodeRow {
  return {
    ...node,
    translation: node.translation ?? null,
    audio_url: node.audio_url ?? null,
    notes: node.notes ?? null,
    created_at: node.created_at ?? nowIso(),
    updated_at: node.updated_at ?? node.created_at ?? nowIso()
  };
}

function sortSources(rows: SourceRow[]) {
  return [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.title.localeCompare(b.title));
}

function sortChunks(rows: ChunkRow[]) {
  return [...rows].sort((a, b) => a.chapter_num - b.chapter_num || a.section_num - b.section_num);
}

function sortNodes(rows: ContentNodeRow[]) {
  return [...rows].sort((a, b) => a.sequence - b.sequence);
}

function createMemoryUser(input: {
  id: string;
  email?: string | null;
  displayName?: string | null;
  passwordHash?: string | null;
  provider?: string | null;
  providerUserId?: string | null;
}): UserRow {
  const now = nowIso();
  return {
    id: input.id,
    email: input.email ?? null,
    display_name: input.displayName ?? null,
    password_hash: input.passwordHash ?? null,
    provider: input.provider ?? null,
    provider_user_id: input.providerUserId ?? null,
    created_at: now,
    updated_at: now
  };
}

class MemoryRepository implements Repository {
  readonly mode = "memory" as const;
  private users = new Map<string, UserRow>([[demoUserId, createMemoryUser({ id: demoUserId, displayName: "Demo User", provider: "demo" })]]);
  private sourceRows = sortSources(sources.map(applySourceDefaults));
  private chunkRows = sortChunks(chunks.map(applyChunkDefaults));
  private nodeRows = sortNodes(contentNodes.map(applyNodeDefaults));
  private progress = [...progressRows];
  private sessions = new Map<string, SessionRow>();

  async ping() {}

  async ensureUser(input: {
    id: string;
    email?: string | null;
    displayName?: string | null;
    passwordHash?: string | null;
    provider?: string | null;
    providerUserId?: string | null;
  }) {
    const existing = this.users.get(input.id);
    if (existing) return existing;
    const user = createMemoryUser(input);
    this.users.set(user.id, user);
    return user;
  }

  async getSources(type?: SourceType) {
    return sortSources(this.sourceRows.filter((row) => row.is_active && row.status !== "archived" && (!type || row.type === type)));
  }

  async getSourceById(sourceId: string) {
    return this.sourceRows.find((row) => row.id === sourceId) ?? null;
  }

  async listAdminSources(filters: AdminSourceFilters = {}) {
    const q = filters.q?.toLowerCase();
    return sortSources(
      this.sourceRows.filter((row) => {
        if (filters.type && row.type !== filters.type) return false;
        if (filters.status && (row.status ?? "published") !== filters.status) return false;
        if (q && !`${row.title} ${row.slug ?? ""}`.toLowerCase().includes(q)) return false;
        return true;
      })
    );
  }

  async createSource(input: SourceInput) {
    const createdAt = nowIso();
    const row = applySourceDefaults({
      id: randomUUID(),
      slug: input.slug ?? null,
      title: input.title,
      type: input.type,
      cover_url: input.coverUrl ?? null,
      is_active: true,
      status: input.status ?? "draft",
      sort_order: input.sortOrder ?? this.sourceRows.length,
      metadata: input.metadata ?? {},
      created_at: createdAt,
      updated_at: createdAt,
      published_at: input.status === "published" ? createdAt : null
    });
    this.sourceRows.push(row);
    return row;
  }

  async updateSource(sourceId: string, patch: SourcePatch) {
    const row = this.sourceRows.find((item) => item.id === sourceId);
    if (!row) return null;
    row.slug = patch.slug ?? row.slug;
    row.title = patch.title ?? row.title;
    row.type = patch.type ?? row.type;
    row.cover_url = patch.coverUrl === undefined ? row.cover_url : patch.coverUrl;
    row.status = patch.status ?? row.status;
    row.sort_order = patch.sortOrder ?? row.sort_order;
    row.metadata = patch.metadata ?? row.metadata;
    row.is_active = patch.isActive ?? row.is_active;
    row.updated_at = nowIso();
    row.published_at = row.status === "published" ? row.published_at ?? row.updated_at : null;
    return row;
  }

  async getChunksForSource(sourceId: string) {
    return sortChunks(this.chunkRows.filter((row) => row.source_id === sourceId));
  }

  async getChunkById(chunkId: string) {
    return this.chunkRows.find((row) => row.id === chunkId) ?? null;
  }

  async createChunk(input: ChunkInput) {
    const createdAt = nowIso();
    const row = applyChunkDefaults({
      id: randomUUID(),
      source_id: input.sourceId,
      chapter_num: input.chapterNum,
      section_num: input.sectionNum,
      title: input.title,
      summary: input.summary ?? null,
      dependencies: input.dependencies ?? [],
      map_zone: input.mapZone ?? "default",
      map_pos_x: input.mapPosX ?? 0,
      map_pos_y: input.mapPosY ?? 0,
      word_count: 0,
      metadata: input.metadata ?? {},
      created_at: createdAt,
      updated_at: createdAt
    });
    this.chunkRows.push(row);
    return row;
  }

  async updateChunk(chunkId: string, patch: ChunkPatch) {
    const row = this.chunkRows.find((item) => item.id === chunkId);
    if (!row) return null;
    row.chapter_num = patch.chapterNum ?? row.chapter_num;
    row.section_num = patch.sectionNum ?? row.section_num;
    row.title = patch.title ?? row.title;
    row.summary = patch.summary === undefined ? row.summary : patch.summary;
    row.dependencies = patch.dependencies ?? row.dependencies;
    row.map_zone = patch.mapZone ?? row.map_zone;
    row.map_pos_x = patch.mapPosX ?? row.map_pos_x;
    row.map_pos_y = patch.mapPosY ?? row.map_pos_y;
    row.metadata = patch.metadata ?? row.metadata;
    row.updated_at = nowIso();
    return row;
  }

  async deleteChunk(chunkId: string) {
    const before = this.chunkRows.length;
    this.chunkRows = this.chunkRows.filter((row) => row.id !== chunkId);
    this.nodeRows = this.nodeRows.filter((row) => row.chunk_id !== chunkId);
    this.progress = this.progress.filter((row) => row.chunk_id !== chunkId);
    return this.chunkRows.length < before;
  }

  async reorderChunks(sourceId: string, orderedChunkIds: string[]) {
    const sourceChunks = sortChunks(this.chunkRows.filter((row) => row.source_id === sourceId));
    orderedChunkIds.forEach((chunkId, index) => {
      const chunk = sourceChunks.find((item) => item.id === chunkId);
      if (!chunk) return;
      chunk.section_num = index + 1;
      chunk.updated_at = nowIso();
    });
    return this.getChunksForSource(sourceId);
  }

  async getNodesForChunk(chunkId: string, cursorSeq: number, limit: number) {
    return sortNodes(this.nodeRows.filter((row) => row.chunk_id === chunkId && row.sequence >= cursorSeq)).slice(0, limit);
  }

  async listNodesForChunk(chunkId: string) {
    return sortNodes(this.nodeRows.filter((row) => row.chunk_id === chunkId));
  }

  async createNode(input: NodeInput) {
    const createdAt = nowIso();
    const row = applyNodeDefaults({
      id: randomUUID(),
      chunk_id: input.chunkId,
      sequence: input.sequence,
      raw_text: input.rawText,
      clean_text: input.cleanText,
      translation: input.translation ?? null,
      audio_url: input.audioUrl ?? null,
      notes: input.notes ?? null,
      created_at: createdAt,
      updated_at: createdAt
    });
    this.nodeRows.push(row);
    const chunkNodes = this.nodeRows.filter((item) => item.chunk_id === input.chunkId);
    const chunk = this.chunkRows.find((item) => item.id === input.chunkId);
    if (chunk) chunk.word_count = computeWordCount(chunkNodes);
    return row;
  }

  async updateNode(nodeId: string, patch: NodePatch) {
    const row = this.nodeRows.find((item) => item.id === nodeId);
    if (!row) return null;
    row.sequence = patch.sequence ?? row.sequence;
    row.raw_text = patch.rawText ?? row.raw_text;
    row.clean_text = patch.cleanText ?? row.clean_text;
    row.translation = patch.translation === undefined ? row.translation : patch.translation;
    row.audio_url = patch.audioUrl === undefined ? row.audio_url : patch.audioUrl;
    row.notes = patch.notes === undefined ? row.notes : patch.notes;
    row.updated_at = nowIso();
    const chunkNodes = this.nodeRows.filter((item) => item.chunk_id === row.chunk_id);
    const chunk = this.chunkRows.find((item) => item.id === row.chunk_id);
    if (chunk) chunk.word_count = computeWordCount(chunkNodes);
    return row;
  }

  async deleteNode(nodeId: string) {
    const row = this.nodeRows.find((item) => item.id === nodeId);
    if (!row) return false;
    this.nodeRows = this.nodeRows.filter((item) => item.id !== nodeId);
    const chunkNodes = this.nodeRows.filter((item) => item.chunk_id === row.chunk_id);
    const chunk = this.chunkRows.find((item) => item.id === row.chunk_id);
    if (chunk) chunk.word_count = computeWordCount(chunkNodes);
    return true;
  }

  async resequenceNodes(chunkId: string, orderedNodeIds: string[]) {
    const chunkNodes = this.nodeRows.filter((row) => row.chunk_id === chunkId);
    orderedNodeIds.forEach((nodeId, index) => {
      const node = chunkNodes.find((item) => item.id === nodeId);
      if (!node) return;
      node.sequence = index + 1;
      node.updated_at = nowIso();
    });
    return this.listNodesForChunk(chunkId);
  }

  async getProgressForUser(userId: string) {
    return this.progress.filter((row) => row.user_id === userId);
  }

  async reportProgress(input: {
    userId: string;
    chunkId: string;
    wpm: number;
    accuracy: number;
    currentSeq: number;
    starsEarned: number;
    passed: boolean;
  }) {
    const existing = this.progress.find((row) => row.user_id === input.userId && row.chunk_id === input.chunkId);
    const nextSequence = Math.max(1, input.currentSeq);
    const now = nowIso();

    if (!existing) {
      const created: UserProgressRow = {
        id: uuidFromChunkId(input.chunkId),
        user_id: input.userId,
        chunk_id: input.chunkId,
        highest_wpm: input.wpm,
        highest_accuracy: input.accuracy,
        stars_earned: input.starsEarned,
        last_node_sequence: nextSequence,
        is_completed: input.passed,
        updated_at: now
      };
      this.progress.push(created);
      return created;
    }

    existing.highest_wpm = Math.max(existing.highest_wpm, input.wpm);
    existing.highest_accuracy = Math.max(existing.highest_accuracy, input.accuracy);
    existing.stars_earned = Math.max(existing.stars_earned, input.starsEarned);
    existing.last_node_sequence = Math.max(existing.last_node_sequence, nextSequence);
    existing.is_completed = existing.is_completed || input.passed;
    existing.updated_at = now;
    return existing;
  }

  async getUserByEmail(email: string) {
    const normalized = email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (user.email && user.email.toLowerCase() === normalized) return user;
    }
    return null;
  }

  async getUserById(userId: string) {
    return this.users.get(userId) ?? null;
  }

  async createUser(input: { email: string; passwordHash: string; displayName?: string | null }) {
    const now = nowIso();
    const user: UserRow = {
      id: randomUUID(),
      email: input.email.toLowerCase().trim(),
      display_name: input.displayName ?? null,
      password_hash: input.passwordHash,
      provider: null,
      provider_user_id: null,
      created_at: now,
      updated_at: now
    };
    this.users.set(user.id, user);
    return user;
  }

  async createSession(input: { userId: string; tokenHash: string; expiresAt: string }) {
    const session: SessionRow = {
      id: randomUUID(),
      user_id: input.userId,
      token_hash: input.tokenHash,
      expires_at: input.expiresAt,
      created_at: nowIso()
    };
    this.sessions.set(session.token_hash, session);
    return session;
  }

  async getSessionByTokenHash(tokenHash: string) {
    return this.sessions.get(tokenHash) ?? null;
  }

  async deleteSession(tokenHash: string) {
    return this.sessions.delete(tokenHash);
  }
}

class PostgresRepository implements Repository {
  readonly mode = "postgres" as const;
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async ping() {
    await this.pool.query("SELECT 1");
  }

  async ensureUser(input: {
    id: string;
    email?: string | null;
    displayName?: string | null;
    passwordHash?: string | null;
    provider?: string | null;
    providerUserId?: string | null;
  }) {
    const result = await this.pool.query<UserRow>(
      `
      INSERT INTO users (id, email, display_name, password_hash, provider, provider_user_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        email = COALESCE(EXCLUDED.email, users.email),
        display_name = COALESCE(EXCLUDED.display_name, users.display_name),
        password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
        provider = COALESCE(EXCLUDED.provider, users.provider),
        provider_user_id = COALESCE(EXCLUDED.provider_user_id, users.provider_user_id),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
      `,
      [input.id, input.email ?? null, input.displayName ?? null, input.passwordHash ?? null, input.provider ?? null, input.providerUserId ?? null]
    );
    return result.rows[0];
  }

  async getSources(type?: SourceType) {
    const values: unknown[] = [];
    let sql = "SELECT * FROM sources WHERE is_active = true AND status = 'published'";
    if (type) {
      values.push(type);
      sql += ` AND type = $${values.length}`;
    }
    sql += " ORDER BY sort_order, created_at DESC";
    const result = await this.pool.query<SourceRow>(sql, values);
    return result.rows;
  }

  async getSourceById(sourceId: string) {
    const result = await this.pool.query<SourceRow>("SELECT * FROM sources WHERE id = $1", [sourceId]);
    return result.rows[0] ?? null;
  }

  async listAdminSources(filters: AdminSourceFilters = {}) {
    const values: unknown[] = [];
    const clauses = ["1 = 1"];
    if (filters.type) {
      values.push(filters.type);
      clauses.push(`type = $${values.length}`);
    }
    if (filters.status) {
      values.push(filters.status);
      clauses.push(`status = $${values.length}`);
    }
    if (filters.q) {
      values.push(`%${filters.q}%`);
      clauses.push(`(title ILIKE $${values.length} OR slug ILIKE $${values.length})`);
    }
    const result = await this.pool.query<SourceRow>(`SELECT * FROM sources WHERE ${clauses.join(" AND ")} ORDER BY sort_order, created_at DESC`, values);
    return result.rows;
  }

  async createSource(input: SourceInput) {
    const status = input.status ?? "draft";
    const result = await this.pool.query<SourceRow>(
      `
      INSERT INTO sources (slug, title, type, cover_url, is_active, status, sort_order, metadata, created_at, updated_at, published_at)
      VALUES ($1, $2, $3, $4, true, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $8)
      RETURNING *
      `,
      [input.slug ?? null, input.title, input.type, input.coverUrl ?? null, status, input.sortOrder ?? 0, input.metadata ?? {}, status === "published" ? new Date().toISOString() : null]
    );
    return result.rows[0];
  }

  async updateSource(sourceId: string, patch: SourcePatch) {
    const values = [sourceId, patch.slug ?? null, patch.title ?? null, patch.type ?? null, patch.coverUrl ?? null, patch.status ?? null, patch.sortOrder ?? null, patch.metadata ?? null, patch.isActive ?? null];
    const result = await this.pool.query<SourceRow>(
      `
      UPDATE sources
      SET slug = COALESCE($2, slug),
          title = COALESCE($3, title),
          type = COALESCE($4, type),
          cover_url = COALESCE($5, cover_url),
          status = COALESCE($6, status),
          sort_order = COALESCE($7, sort_order),
          metadata = COALESCE($8, metadata),
          is_active = COALESCE($9, is_active),
          updated_at = CURRENT_TIMESTAMP,
          published_at = CASE
            WHEN COALESCE($6, status) = 'published' THEN COALESCE(published_at, CURRENT_TIMESTAMP)
            ELSE published_at
          END
      WHERE id = $1
      RETURNING *
      `,
      values
    );
    return result.rows[0] ?? null;
  }

  async getChunksForSource(sourceId: string) {
    const result = await this.pool.query<ChunkRow>("SELECT * FROM chunks WHERE source_id = $1 ORDER BY chapter_num, section_num", [sourceId]);
    return result.rows;
  }

  async getChunkById(chunkId: string) {
    const result = await this.pool.query<ChunkRow>("SELECT * FROM chunks WHERE id = $1", [chunkId]);
    return result.rows[0] ?? null;
  }

  async createChunk(input: ChunkInput) {
    const result = await this.pool.query<ChunkRow>(
      `
      INSERT INTO chunks (
        source_id, chapter_num, section_num, title, summary, dependencies, map_zone, map_pos_x, map_pos_y, word_count, metadata, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
      `,
      [input.sourceId, input.chapterNum, input.sectionNum, input.title, input.summary ?? null, input.dependencies ?? [], input.mapZone ?? "default", input.mapPosX ?? 0, input.mapPosY ?? 0, input.metadata ?? {}]
    );
    return result.rows[0];
  }

  async updateChunk(chunkId: string, patch: ChunkPatch) {
    const result = await this.pool.query<ChunkRow>(
      `
      UPDATE chunks
      SET chapter_num = COALESCE($2, chapter_num),
          section_num = COALESCE($3, section_num),
          title = COALESCE($4, title),
          summary = COALESCE($5, summary),
          dependencies = COALESCE($6, dependencies),
          map_zone = COALESCE($7, map_zone),
          map_pos_x = COALESCE($8, map_pos_x),
          map_pos_y = COALESCE($9, map_pos_y),
          metadata = COALESCE($10, metadata),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
      `,
      [chunkId, patch.chapterNum ?? null, patch.sectionNum ?? null, patch.title ?? null, patch.summary ?? null, patch.dependencies ?? null, patch.mapZone ?? null, patch.mapPosX ?? null, patch.mapPosY ?? null, patch.metadata ?? null]
    );
    return result.rows[0] ?? null;
  }

  async deleteChunk(chunkId: string) {
    const result = await this.pool.query("DELETE FROM chunks WHERE id = $1", [chunkId]);
    return (result.rowCount ?? 0) > 0;
  }

  async reorderChunks(sourceId: string, orderedChunkIds: string[]) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (let index = 0; index < orderedChunkIds.length; index += 1) {
        await client.query(
          `
          UPDATE chunks
          SET section_num = $3,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND source_id = $2
          `,
          [orderedChunkIds[index], sourceId, index + 1]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return this.getChunksForSource(sourceId);
  }

  async getNodesForChunk(chunkId: string, cursorSeq: number, limit: number) {
    const result = await this.pool.query<ContentNodeRow>(
      "SELECT * FROM content_nodes WHERE chunk_id = $1 AND sequence >= $2 ORDER BY sequence LIMIT $3",
      [chunkId, cursorSeq, limit]
    );
    return result.rows;
  }

  async listNodesForChunk(chunkId: string) {
    const result = await this.pool.query<ContentNodeRow>("SELECT * FROM content_nodes WHERE chunk_id = $1 ORDER BY sequence", [chunkId]);
    return result.rows;
  }

  async createNode(input: NodeInput) {
    const result = await this.pool.query<ContentNodeRow>(
      `
      INSERT INTO content_nodes (chunk_id, sequence, raw_text, clean_text, translation, audio_url, notes, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
      `,
      [input.chunkId, input.sequence, input.rawText, input.cleanText, input.translation ?? null, input.audioUrl ?? null, input.notes ?? null]
    );
    await this.refreshChunkWordCount(input.chunkId);
    return result.rows[0];
  }

  async updateNode(nodeId: string, patch: NodePatch) {
    const result = await this.pool.query<ContentNodeRow>(
      `
      UPDATE content_nodes
      SET sequence = COALESCE($2, sequence),
          raw_text = COALESCE($3, raw_text),
          clean_text = COALESCE($4, clean_text),
          translation = COALESCE($5, translation),
          audio_url = COALESCE($6, audio_url),
          notes = COALESCE($7, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
      `,
      [nodeId, patch.sequence ?? null, patch.rawText ?? null, patch.cleanText ?? null, patch.translation ?? null, patch.audioUrl ?? null, patch.notes ?? null]
    );
    const row = result.rows[0] ?? null;
    if (row) {
      await this.refreshChunkWordCount(row.chunk_id);
    }
    return row;
  }

  async deleteNode(nodeId: string) {
    const result = await this.pool.query<{ chunk_id: string }>("DELETE FROM content_nodes WHERE id = $1 RETURNING chunk_id", [nodeId]);
    const row = result.rows[0];
    if (row) {
      await this.refreshChunkWordCount(row.chunk_id);
    }
    return Boolean(row);
  }

  async resequenceNodes(chunkId: string, orderedNodeIds: string[]) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (let index = 0; index < orderedNodeIds.length; index += 1) {
        await client.query(
          `
          UPDATE content_nodes
          SET sequence = $3,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND chunk_id = $2
          `,
          [orderedNodeIds[index], chunkId, index + 1]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    await this.refreshChunkWordCount(chunkId);
    return this.listNodesForChunk(chunkId);
  }

  async getProgressForUser(userId: string) {
    const result = await this.pool.query<UserProgressRow>("SELECT * FROM user_progress WHERE user_id = $1", [userId]);
    return result.rows;
  }

  async reportProgress(input: {
    userId: string;
    chunkId: string;
    wpm: number;
    accuracy: number;
    currentSeq: number;
    starsEarned: number;
    passed: boolean;
  }) {
    const nextSequence = Math.max(1, input.currentSeq);
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
        last_node_sequence = GREATEST(user_progress.last_node_sequence, EXCLUDED.last_node_sequence),
        is_completed = user_progress.is_completed OR EXCLUDED.is_completed,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
      `,
      [input.userId, input.chunkId, input.wpm, input.accuracy, input.starsEarned, nextSequence, input.passed]
    );
    return result.rows[0];
  }

  async getUserByEmail(email: string) {
    const result = await this.pool.query<UserRow>("SELECT * FROM users WHERE LOWER(email) = LOWER($1)", [email.trim()]);
    return result.rows[0] ?? null;
  }

  async getUserById(userId: string) {
    const result = await this.pool.query<UserRow>("SELECT * FROM users WHERE id = $1", [userId]);
    return result.rows[0] ?? null;
  }

  async createUser(input: { email: string; passwordHash: string; displayName?: string | null }) {
    const result = await this.pool.query<UserRow>(
      `
      INSERT INTO users (email, display_name, password_hash, created_at, updated_at)
      VALUES (LOWER($1), $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
      `,
      [input.email.trim(), input.displayName ?? null, input.passwordHash]
    );
    return result.rows[0];
  }

  async createSession(input: { userId: string; tokenHash: string; expiresAt: string }) {
    const result = await this.pool.query<SessionRow>(
      `
      INSERT INTO sessions (user_id, token_hash, expires_at, created_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      RETURNING *
      `,
      [input.userId, input.tokenHash, input.expiresAt]
    );
    return result.rows[0];
  }

  async getSessionByTokenHash(tokenHash: string) {
    const result = await this.pool.query<SessionRow>("SELECT * FROM sessions WHERE token_hash = $1", [tokenHash]);
    return result.rows[0] ?? null;
  }

  async deleteSession(tokenHash: string) {
    const result = await this.pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
    return (result.rowCount ?? 0) > 0;
  }

  private async refreshChunkWordCount(chunkId: string) {
    await this.pool.query(
      `
      UPDATE chunks
      SET word_count = COALESCE((
            SELECT SUM(cardinality(regexp_split_to_array(trim(raw_text), E'\\s+')))
            FROM content_nodes
            WHERE chunk_id = $1
          ), 0),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [chunkId]
    );
  }
}

export function createRepository(): Repository {
  if (process.env.DATABASE_URL) {
    return new PostgresRepository(process.env.DATABASE_URL);
  }
  return new MemoryRepository();
}

export { demoUserId };
