import type { Chunk, ContentNode, Source, SourceStatus, SourceType } from "../types";
import { request } from "./client";

// Supplied by the owner at runtime. Never compile a secret into the public bundle
// or persist it in browser storage.
let adminToken = "";

export function clearAdminToken() {
  adminToken = "";
}

function adminHeaders() {
  return adminToken ? { "x-admin-token": adminToken } : undefined;
}

export async function authenticateAdmin(token: string) {
  const candidate = token.trim();
  await request<Source[]>("/api/admin/v1/sources", undefined, { "x-admin-token": candidate });
  adminToken = candidate;
}

export function listAdminSources(filters?: { type?: SourceType; status?: SourceStatus; q?: string }) {
  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.q) params.set("q", filters.q);
  const query = params.toString();
  return request<Source[]>(`/api/admin/v1/sources${query ? `?${query}` : ""}`, undefined, adminHeaders());
}

export function createAdminSource(payload: Partial<Source> & { title: string; type: SourceType }) {
  return request<Source>("/api/admin/v1/sources", { method: "POST", body: JSON.stringify(payload) }, adminHeaders());
}

export function updateAdminSource(sourceId: string, payload: Partial<Source>) {
  return request<Source>(`/api/admin/v1/sources/${sourceId}`, { method: "PATCH", body: JSON.stringify(payload) }, adminHeaders());
}

export function publishAdminSource(sourceId: string) {
  return request<Source>(`/api/admin/v1/sources/${sourceId}/publish`, { method: "POST" }, adminHeaders());
}

export function archiveAdminSource(sourceId: string) {
  return request<Source>(`/api/admin/v1/sources/${sourceId}/archive`, { method: "POST" }, adminHeaders());
}

export function listAdminChunks(sourceId: string) {
  return request<Chunk[]>(`/api/admin/v1/sources/${sourceId}/chunks`, undefined, adminHeaders());
}

export function createAdminChunk(sourceId: string, payload: Partial<Chunk> & { title: string }) {
  return request<Chunk>(`/api/admin/v1/sources/${sourceId}/chunks`, { method: "POST", body: JSON.stringify(payload) }, adminHeaders());
}

export function updateAdminChunk(chunkId: string, payload: Partial<Chunk>) {
  return request<Chunk>(`/api/admin/v1/chunks/${chunkId}`, { method: "PATCH", body: JSON.stringify(payload) }, adminHeaders());
}

export function deleteAdminChunk(chunkId: string) {
  return request<{ deleted: boolean }>(`/api/admin/v1/chunks/${chunkId}`, { method: "DELETE" }, adminHeaders());
}

export function reorderAdminChunks(sourceId: string, orderedChunkIds: string[]) {
  return request<Chunk[]>(`/api/admin/v1/chunks/reorder`, { method: "POST", body: JSON.stringify({ sourceId, orderedChunkIds }) }, adminHeaders());
}

export function listAdminNodes(chunkId: string) {
  return request<ContentNode[]>(`/api/admin/v1/chunks/${chunkId}/nodes`, undefined, adminHeaders());
}

export function createAdminNode(chunkId: string, payload: Partial<ContentNode> & { rawText: string; cleanText: string }) {
  return request<ContentNode>(`/api/admin/v1/chunks/${chunkId}/nodes`, { method: "POST", body: JSON.stringify(payload) }, adminHeaders());
}

export function updateAdminNode(nodeId: string, payload: Partial<ContentNode>) {
  return request<ContentNode>(`/api/admin/v1/nodes/${nodeId}`, { method: "PATCH", body: JSON.stringify(payload) }, adminHeaders());
}

export function deleteAdminNode(nodeId: string) {
  return request<{ deleted: boolean }>(`/api/admin/v1/nodes/${nodeId}`, { method: "DELETE" }, adminHeaders());
}
