import type { AdventureInputMode } from "../shared/adventure/evaluator";

export type SourceType = "SERIES" | "BOOK" | "VOCAB";
export type SourceStatus = "draft" | "published" | "archived";
export type InputMode = AdventureInputMode;

export interface AnonymousIdentity {
  kind: "anonymous";
}

export interface AuthenticatedIdentity {
  kind: "authenticated";
  userId: string;
  email: string | null;
  displayName: string | null;
}

export type Identity = AnonymousIdentity | AuthenticatedIdentity;

export const ANONYMOUS_IDENTITY: AnonymousIdentity = Object.freeze({ kind: "anonymous" });

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
}

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
  identity: Identity;
  chunks: MapChunk[];
}

export interface ProgressReportPayload {
  chunk_id: string;
  wpm: number;
  accuracy: number;
  error_count: number;
  elapsed_seconds: number;
  input_mode: InputMode;
  completed: boolean;
  timed_out: boolean;
  current_seq: number;
}

export interface ProgressResult {
  chunkId: string;
  wpm: number;
  accuracy: number;
  errorCount: number;
  elapsedSeconds: number;
  inputMode: InputMode;
  completed: boolean;
  timedOut: boolean;
  currentSequence: number;
  starsEarned: number;
  isCompleted: boolean;
  passed: boolean;
  failureReason: string | null;
  nextStarHint: string | null;
}

export interface ProgressReportResponse {
  identity: Identity;
  persisted: boolean;
  result: ProgressResult;
}
