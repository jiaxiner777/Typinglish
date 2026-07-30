import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { createApp } from "../server/app/createApp.js";
import type { AppEnv } from "../server/config/env.js";
import type { Repository } from "../server/repository.js";
import type { ChunkRow, ContentNodeRow, SourceRow } from "../server/types.js";
import { applyGuestProgress, createGuestProgressStore, mapProgressForIdentity } from "../src/store/guestProgress.js";
import type { MapChunk } from "../src/types.js";

const now = "2026-01-01T00:00:00.000Z";

function adventureAttempt(patch: Record<string, unknown> = {}) {
  return {
    chunk_id: "chunk-1",
    wpm: 70,
    accuracy: 100,
    error_count: 0,
    elapsed_seconds: 10,
    input_mode: "STRICT",
    completed: true,
    timed_out: false,
    current_seq: 2,
    ...patch
  };
}

const source: SourceRow = {
  id: "source-1",
  slug: "public-source",
  title: "Public Source",
  type: "SERIES",
  cover_url: null,
  is_active: true,
  status: "published",
  sort_order: 0,
  metadata: {},
  created_at: now,
  updated_at: now,
  published_at: now
};

const chunkRows: ChunkRow[] = [
  {
    id: "chunk-1",
    source_id: source.id,
    chapter_num: 1,
    section_num: 1,
    title: "First Level",
    dependencies: [],
    map_zone: "test",
    map_pos_x: 0,
    map_pos_y: 0,
    word_count: 2,
    metadata: {},
    created_at: now,
    updated_at: now
  },
  {
    id: "chunk-2",
    source_id: source.id,
    chapter_num: 1,
    section_num: 2,
    title: "Second Level",
    dependencies: ["chunk-1"],
    map_zone: "test",
    map_pos_x: 1,
    map_pos_y: 1,
    word_count: 2,
    metadata: {},
    created_at: now,
    updated_at: now
  }
];

const nodeRows: ContentNodeRow[] = [
  {
    id: "node-1",
    chunk_id: "chunk-1",
    sequence: 1,
    raw_text: "hello world",
    clean_text: "hello world",
    translation: null,
    audio_url: null,
    created_at: now,
    updated_at: now
  }
];

const baseMapChunks: MapChunk[] = chunkRows.map((chunk) => ({
  id: chunk.id,
  sourceId: chunk.source_id,
  chapterNum: chunk.chapter_num,
  sectionNum: chunk.section_num,
  title: chunk.title,
  summary: null,
  dependencies: chunk.dependencies,
  mapZone: chunk.map_zone,
  mapPosX: chunk.map_pos_x,
  mapPosY: chunk.map_pos_y,
  wordCount: chunk.word_count,
  metadata: {},
  createdAt: now,
  updatedAt: now,
  progress: { highestWpm: 0, highestAccuracy: 0, starsEarned: 0, lastNodeSequence: 1, isCompleted: false },
  locked: chunk.dependencies.length > 0
}));

function createFakeRepository() {
  const calls = { ensureUser: 0, getProgressForUser: 0, reportProgress: 0, listAdminSources: 0 };
  const unsupported = async () => {
    throw new Error("Unexpected repository call");
  };

  const repo = {
    mode: "memory" as const,
    ping: async () => {},
    ensureUser: async () => {
      calls.ensureUser += 1;
      return unsupported();
    },
    getSources: async () => [source],
    getSourceById: async () => source,
    listAdminSources: async () => {
      calls.listAdminSources += 1;
      return [source];
    },
    getChunksForSource: async () => chunkRows,
    getChunkById: async () => chunkRows[0],
    getNodesForChunk: async () => nodeRows,
    listNodesForChunk: async () => nodeRows,
    getProgressForUser: async () => {
      calls.getProgressForUser += 1;
      return [];
    },
    reportProgress: async () => {
      calls.reportProgress += 1;
      return unsupported();
    },
    getUserByEmail: async () => null,
    getUserById: async () => null,
    createUser: unsupported,
    createSession: unsupported,
    getSessionByTokenHash: async () => null,
    deleteSession: async () => false,
    createSource: unsupported,
    updateSource: unsupported,
    createChunk: unsupported,
    updateChunk: unsupported,
    deleteChunk: unsupported,
    reorderChunks: unsupported,
    createNode: unsupported,
    updateNode: unsupported,
    deleteNode: unsupported,
    resequenceNodes: unsupported
  } as unknown as Repository;

  return { repo, calls };
}

const env: AppEnv = {
  port: 0,
  databaseUrl: null,
  nodeEnv: "test",
  corsOrigins: [],
  adminToken: null,
  cookieSecure: false
};

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const { repo, calls } = createFakeRepository();
  const server = createApp(env, repo).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
  return calls;
}

test("anonymous progress stores are isolated and a recreated store starts empty", () => {
  const firstClient = createGuestProgressStore();
  const secondClient = createGuestProgressStore();

  firstClient.getState().reportProgress({
    chunkId: "chunk-1",
    wpm: 70,
    accuracy: 100,
    currentSequence: 2,
    starsEarned: 3,
    passed: true
  });

  const firstMap = applyGuestProgress(baseMapChunks, firstClient.getState().progressByChunk);
  const secondMap = applyGuestProgress(baseMapChunks, secondClient.getState().progressByChunk);
  assert.equal(firstMap[0].progress.isCompleted, true);
  assert.equal(firstMap[1].locked, false);
  assert.deepEqual(secondClient.getState().progressByChunk, {});
  assert.equal(secondMap[0].progress.isCompleted, false);
  assert.equal(secondMap[1].locked, true);

  const refreshedClient = createGuestProgressStore();
  assert.deepEqual(refreshedClient.getState().progressByChunk, {});
  assert.equal(applyGuestProgress(baseMapChunks, refreshedClient.getState().progressByChunk)[1].locked, true);
});

test("authenticated maps do not apply or overwrite progress from the guest store", () => {
  const authenticatedChunks = baseMapChunks.map((chunk, index) =>
    index === 0
      ? { ...chunk, progress: { ...chunk.progress, starsEarned: 3, isCompleted: true } }
      : { ...chunk, locked: false }
  );
  const guestProgress = {
    "chunk-1": {
      highestWpm: 10,
      highestAccuracy: 50,
      starsEarned: 0,
      lastNodeSequence: 1,
      isCompleted: false
    }
  };

  const resolved = mapProgressForIdentity(authenticatedChunks, guestProgress, "authenticated");
  assert.equal(resolved[0].progress.starsEarned, 3);
  assert.equal(resolved[0].progress.isCompleted, true);
  assert.equal(resolved[1].locked, false);
});

test("anonymous clients can read public content without creating or loading a user", async () => {
  const calls = await withServer(async (baseUrl) => {
    const sourcesResponse = await fetch(`${baseUrl}/api/v1/sources`);
    const mapResponse = await fetch(`${baseUrl}/api/v1/sources/${source.id}/map`, {
      headers: { "x-typinglish-user-id": "forged-user" }
    });
    const streamResponse = await fetch(`${baseUrl}/api/v1/chunks/chunk-1/stream`);

    assert.equal(sourcesResponse.status, 200);
    assert.equal(streamResponse.status, 200);
    const map = await mapResponse.json();
    assert.equal(map.identity.kind, "anonymous");
    assert.equal(map.chunks[0].progress.isCompleted, false);
    assert.equal(map.chunks[1].locked, true);
  });

  assert.equal(calls.ensureUser, 0);
  assert.equal(calls.getProgressForUser, 0);
  assert.equal(calls.reportProgress, 0);
});

test("anonymous completion and forged user identifiers never write progress", async () => {
  const calls = await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/progress/report?userId=victim-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-typinglish-user-id": "victim-user"
      },
      body: JSON.stringify(adventureAttempt({ userId: "victim-user" }))
    });

    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.identity.kind, "anonymous");
    assert.equal(result.persisted, false);
    assert.equal(result.result.isCompleted, true);
    assert.equal(result.result.starsEarned, 3);
  });

  assert.equal(calls.ensureUser, 0);
  assert.equal(calls.getProgressForUser, 0);
  assert.equal(calls.reportProgress, 0);
});

test("admin content routes remain mounted", async () => {
  const calls = await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/v1/sources`);
    assert.equal(response.status, 200);
    assert.equal((await response.json())[0].title, source.title);
  });

  assert.equal(calls.listAdminSources, 1);
});
