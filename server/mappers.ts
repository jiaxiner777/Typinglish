import type { ChunkRow, ContentNodeRow, SourceRow, UserProgressRow } from "./types.js";

export function sourceDto(row: SourceRow) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    type: row.type,
    coverUrl: row.cover_url,
    isActive: row.is_active,
    status: row.status ?? "published",
    sortOrder: row.sort_order ?? 0,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    publishedAt: row.published_at ?? null
  };
}

export function chunkDto(row: ChunkRow) {
  return {
    id: row.id,
    sourceId: row.source_id,
    chapterNum: row.chapter_num,
    sectionNum: row.section_num,
    title: row.title,
    summary: row.summary ?? null,
    dependencies: row.dependencies,
    mapZone: row.map_zone,
    mapPosX: row.map_pos_x,
    mapPosY: row.map_pos_y,
    wordCount: row.word_count,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at
  };
}

export function nodeDto(row: ContentNodeRow) {
  return {
    id: row.id,
    chunkId: row.chunk_id,
    sequence: row.sequence,
    rawText: row.raw_text,
    cleanText: row.clean_text,
    translation: row.translation,
    audioUrl: row.audio_url,
    notes: row.notes ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? row.created_at ?? null
  };
}

export function progressDto(row: UserProgressRow) {
  return {
    id: row.id,
    userId: row.user_id,
    chunkId: row.chunk_id,
    highestWpm: row.highest_wpm,
    highestAccuracy: row.highest_accuracy,
    starsEarned: row.stars_earned,
    lastNodeSequence: row.last_node_sequence,
    isCompleted: row.is_completed,
    updatedAt: row.updated_at
  };
}
