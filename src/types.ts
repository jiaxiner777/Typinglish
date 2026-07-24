export type SourceType = "SERIES" | "BOOK" | "VOCAB";
export type SourceStatus = "draft" | "published" | "archived";
export type InputMode = "STRICT" | "TOLERANT";

export interface AnonymousIdentity {
  kind: "anonymous";
}

export const ANONYMOUS_IDENTITY: AnonymousIdentity = Object.freeze({ kind: "anonymous" });

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

export interface ChunkProgress {
  highestWpm: number;
  highestAccuracy: number;
  starsEarned: number;
  lastNodeSequence: number;
  isCompleted: boolean;
  updatedAt: string;
}

export interface UserProgress extends ChunkProgress {
  id: string;
  userId: string;
  chunkId: string;
}

export interface MapChunk extends Chunk {
  progress: Omit<ChunkProgress, "updatedAt">;
  locked: boolean;
}

export interface SourceMapResponse {
  sourceId: string;
  identity: AnonymousIdentity;
  chunks: MapChunk[];
}

export interface ProgressReportPayload {
  chunk_id: string;
  wpm: number;
  accuracy: number;
  current_seq: number;
}

export interface AnonymousProgressResult {
  chunkId: string;
  wpm: number;
  accuracy: number;
  currentSequence: number;
  starsEarned: number;
  isCompleted: boolean;
}

export interface ProgressReportResponse {
  identity: AnonymousIdentity;
  persisted: false;
  result: AnonymousProgressResult;
}
