export type SourceType = "SERIES" | "BOOK" | "VOCAB";
export type SourceStatus = "draft" | "published" | "archived";

export interface UserRow {
  id: string;
  email: string | null;
  display_name: string | null;
  password_hash: string | null;
  provider: string | null;
  provider_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourceRow {
  id: string;
  slug: string | null;
  title: string;
  type: SourceType;
  cover_url: string | null;
  is_active: boolean;
  status?: SourceStatus;
  sort_order?: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
  published_at?: string | null;
}

export interface ChunkRow {
  id: string;
  source_id: string;
  chapter_num: number;
  section_num: number;
  title: string;
  summary?: string | null;
  dependencies: string[];
  map_zone: string;
  map_pos_x: number;
  map_pos_y: number;
  word_count: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export interface ContentNodeRow {
  id: string;
  chunk_id: string;
  sequence: number;
  raw_text: string;
  clean_text: string;
  translation: string | null;
  audio_url: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface UserProgressRow {
  id: string;
  user_id: string;
  chunk_id: string;
  highest_wpm: number;
  highest_accuracy: number;
  stars_earned: number;
  last_node_sequence: number;
  is_completed: boolean;
  updated_at: string;
}

export interface AdminSourceFilters {
  type?: SourceType;
  status?: SourceStatus;
  q?: string;
}

export interface SourceInput {
  slug?: string | null;
  title: string;
  type: SourceType;
  coverUrl?: string | null;
  status?: SourceStatus;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}

export interface SourcePatch {
  slug?: string | null;
  title?: string;
  type?: SourceType;
  coverUrl?: string | null;
  status?: SourceStatus;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
}

export interface ChunkInput {
  sourceId: string;
  chapterNum: number;
  sectionNum: number;
  title: string;
  summary?: string | null;
  dependencies?: string[];
  mapZone?: string;
  mapPosX?: number;
  mapPosY?: number;
  metadata?: Record<string, unknown>;
}

export interface ChunkPatch {
  chapterNum?: number;
  sectionNum?: number;
  title?: string;
  summary?: string | null;
  dependencies?: string[];
  mapZone?: string;
  mapPosX?: number;
  mapPosY?: number;
  metadata?: Record<string, unknown>;
}

export interface NodeInput {
  chunkId: string;
  sequence: number;
  rawText: string;
  cleanText: string;
  translation?: string | null;
  audioUrl?: string | null;
  notes?: string | null;
}

export interface NodePatch {
  sequence?: number;
  rawText?: string;
  cleanText?: string;
  translation?: string | null;
  audioUrl?: string | null;
  notes?: string | null;
}
