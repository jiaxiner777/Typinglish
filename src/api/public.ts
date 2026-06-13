import type { ContentNode, MapChunk, ProgressReportResponse, Source, SourceType } from "../types";
import { request } from "./client";

export function fetchSources(type?: SourceType) {
  const params = type ? `?type=${type}` : "";
  return request<Source[]>(`/api/v1/sources${params}`);
}

export async function fetchSourceMap(sourceId: string) {
  const data = await request<{ sourceId: string; userId: string; chunks: MapChunk[] }>(`/api/v1/sources/${sourceId}/map`);
  return data.chunks;
}

export function fetchSource(sourceId: string) {
  return request<Source>(`/api/v1/sources/${sourceId}`);
}

export async function fetchChunkStream(chunkId: string, cursorSeq = 1, limit = 8) {
  return request<{ nodes: ContentNode[]; nextCursor: number | null; hasMore: boolean }>(
    `/api/v1/chunks/${chunkId}/stream?cursor_seq=${cursorSeq}&limit=${limit}`
  );
}

export function reportProgress(payload: { chunk_id: string; wpm: number; accuracy: number; current_seq: number }) {
  return request<ProgressReportResponse>("/api/v1/progress/report", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
