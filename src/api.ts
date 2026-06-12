import type { ContentNode, MapChunk, ProgressReportResponse, Source, SourceType } from "./types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function fetchSources(type?: SourceType) {
  const params = type ? `?type=${type}` : "";
  return request<Source[]>(`/api/v1/sources${params}`);
}

export async function fetchSourceMap(sourceId: string) {
  const data = await request<{ sourceId: string; chunks: MapChunk[] }>(`/api/v1/sources/${sourceId}/map`);
  return data.chunks;
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
