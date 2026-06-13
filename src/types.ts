export type SourceType = "SERIES" | "BOOK" | "VOCAB";
export type SourceStatus = "draft" | "published" | "archived";
export type InputMode = "STRICT" | "TOLERANT";

export interface Source {
  id: string;
  slug: string | null;
  title: string;
  type: SourceType;
  coverUrl: string | null;
  isActive: boolean;
  status: SourceStatus;
  sortOrder: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface Chunk {
  id: string;
  sourceId: string;
  chapterNum: number;
  sectionNum: number;
  title: string;
  summary: string | null;
  dependencies: string[];
  mapZone: string;
  mapPosX: number;
  mapPosY: number;
  wordCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ContentNode {
  id: string;
  chunkId: string;
  sequence: number;
  rawText: string;
  cleanText: string;
  translation: string | null;
  audioUrl: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface UserProgress {
  id: string;
  userId: string;
  chunkId: string;
  highestWpm: number;
  highestAccuracy: number;
  starsEarned: number;
  lastNodeSequence: number;
  isCompleted: boolean;
  updatedAt: string;
}

export interface MapChunk extends Chunk {
  progress: Pick<UserProgress, "starsEarned" | "isCompleted" | "highestWpm" | "highestAccuracy" | "lastNodeSequence">;
  locked: boolean;
}

export interface ProgressReportPayload {
  chunk_id: string;
  wpm: number;
  accuracy: number;
  current_seq: number;
}

export interface ProgressReportResponse {
  progress: UserProgress;
  unlockedChunkIds: string[];
}
