export type SourceType = "SERIES" | "BOOK" | "VOCAB";

export interface SourceRow {
  id: string;
  title: string;
  type: SourceType;
  cover_url: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ChunkRow {
  id: string;
  source_id: string;
  chapter_num: number;
  section_num: number;
  title: string;
  dependencies: string[];
  map_zone: string;
  map_pos_x: number;
  map_pos_y: number;
  word_count: number;
  created_at: string;
}

export interface ContentNodeRow {
  id: string;
  chunk_id: string;
  sequence: number;
  raw_text: string;
  clean_text: string;
  translation: string | null;
  audio_url: string | null;
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
