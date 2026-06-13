import { Router } from "express";
import { chunkDto, nodeDto, sourceDto } from "../mappers.js";
import type { Repository } from "../repository.js";
import type { ChunkInput, ChunkPatch, NodeInput, NodePatch, SourceInput, SourcePatch, SourceStatus, SourceType } from "../types.js";

function readSourceInput(body: Record<string, unknown>): SourceInput {
  return {
    slug: typeof body.slug === "string" ? body.slug : null,
    title: String(body.title ?? "").trim(),
    type: (body.type as SourceType) ?? "BOOK",
    coverUrl: typeof body.coverUrl === "string" ? body.coverUrl : null,
    status: (body.status as SourceStatus) ?? "draft",
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
    metadata: typeof body.metadata === "object" && body.metadata !== null ? (body.metadata as Record<string, unknown>) : {}
  };
}

function readChunkInput(sourceId: string, body: Record<string, unknown>): ChunkInput {
  return {
    sourceId,
    chapterNum: Number(body.chapterNum ?? 1),
    sectionNum: Number(body.sectionNum ?? 1),
    title: String(body.title ?? "").trim(),
    summary: typeof body.summary === "string" ? body.summary : null,
    dependencies: Array.isArray(body.dependencies) ? body.dependencies.map(String) : [],
    mapZone: typeof body.mapZone === "string" ? body.mapZone : "default",
    mapPosX: Number(body.mapPosX ?? 0),
    mapPosY: Number(body.mapPosY ?? 0),
    metadata: typeof body.metadata === "object" && body.metadata !== null ? (body.metadata as Record<string, unknown>) : {}
  };
}

function readChunkPatch(body: Record<string, unknown>): ChunkPatch {
  return {
    chapterNum: body.chapterNum === undefined ? undefined : Number(body.chapterNum),
    sectionNum: body.sectionNum === undefined ? undefined : Number(body.sectionNum),
    title: typeof body.title === "string" ? body.title : undefined,
    summary: body.summary === undefined ? undefined : typeof body.summary === "string" ? body.summary : null,
    dependencies: Array.isArray(body.dependencies) ? body.dependencies.map(String) : undefined,
    mapZone: typeof body.mapZone === "string" ? body.mapZone : undefined,
    mapPosX: body.mapPosX === undefined ? undefined : Number(body.mapPosX),
    mapPosY: body.mapPosY === undefined ? undefined : Number(body.mapPosY),
    metadata: typeof body.metadata === "object" && body.metadata !== null ? (body.metadata as Record<string, unknown>) : undefined
  };
}

function readNodeInput(chunkId: string, body: Record<string, unknown>): NodeInput {
  return {
    chunkId,
    sequence: Number(body.sequence ?? 1),
    rawText: String(body.rawText ?? "").trim(),
    cleanText: String(body.cleanText ?? "").trim(),
    translation: typeof body.translation === "string" ? body.translation : null,
    audioUrl: typeof body.audioUrl === "string" ? body.audioUrl : null,
    notes: typeof body.notes === "string" ? body.notes : null
  };
}

function readNodePatch(body: Record<string, unknown>): NodePatch {
  return {
    sequence: body.sequence === undefined ? undefined : Number(body.sequence),
    rawText: typeof body.rawText === "string" ? body.rawText : undefined,
    cleanText: typeof body.cleanText === "string" ? body.cleanText : undefined,
    translation: body.translation === undefined ? undefined : typeof body.translation === "string" ? body.translation : null,
    audioUrl: body.audioUrl === undefined ? undefined : typeof body.audioUrl === "string" ? body.audioUrl : null,
    notes: body.notes === undefined ? undefined : typeof body.notes === "string" ? body.notes : null
  };
}

export function createAdminRouter(repo: Repository) {
  const router = Router();

  router.get("/sources", async (req, res, next) => {
    try {
      const rows = await repo.listAdminSources({
        type: req.query.type as SourceType | undefined,
        status: req.query.status as SourceStatus | undefined,
        q: typeof req.query.q === "string" ? req.query.q : undefined
      });
      res.json(rows.map(sourceDto));
    } catch (error) {
      next(error);
    }
  });

  router.post("/sources", async (req, res, next) => {
    try {
      const created = await repo.createSource(readSourceInput(req.body as Record<string, unknown>));
      res.status(201).json(sourceDto(created));
    } catch (error) {
      next(error);
    }
  });

  router.get("/sources/:id", async (req, res, next) => {
    try {
      const row = await repo.getSourceById(req.params.id);
      if (!row) {
        res.status(404).json({ error: "Source not found" });
        return;
      }
      res.json(sourceDto(row));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/sources/:id", async (req, res, next) => {
    try {
      const updated = await repo.updateSource(req.params.id, req.body as SourcePatch);
      if (!updated) {
        res.status(404).json({ error: "Source not found" });
        return;
      }
      res.json(sourceDto(updated));
    } catch (error) {
      next(error);
    }
  });

  router.post("/sources/:id/publish", async (req, res, next) => {
    try {
      const updated = await repo.updateSource(req.params.id, { status: "published", isActive: true });
      if (!updated) {
        res.status(404).json({ error: "Source not found" });
        return;
      }
      res.json(sourceDto(updated));
    } catch (error) {
      next(error);
    }
  });

  router.post("/sources/:id/archive", async (req, res, next) => {
    try {
      const updated = await repo.updateSource(req.params.id, { status: "archived", isActive: false });
      if (!updated) {
        res.status(404).json({ error: "Source not found" });
        return;
      }
      res.json(sourceDto(updated));
    } catch (error) {
      next(error);
    }
  });

  router.get("/sources/:id/chunks", async (req, res, next) => {
    try {
      const rows = await repo.getChunksForSource(req.params.id);
      res.json(rows.map(chunkDto));
    } catch (error) {
      next(error);
    }
  });

  router.post("/sources/:id/chunks", async (req, res, next) => {
    try {
      const created = await repo.createChunk(readChunkInput(req.params.id, req.body as Record<string, unknown>));
      res.status(201).json(chunkDto(created));
    } catch (error) {
      next(error);
    }
  });

  router.post("/chunks/reorder", async (req, res, next) => {
    try {
      const sourceId = String((req.body as { sourceId?: string }).sourceId ?? "");
      const orderedChunkIds = Array.isArray((req.body as { orderedChunkIds?: unknown[] }).orderedChunkIds)
        ? ((req.body as { orderedChunkIds?: unknown[] }).orderedChunkIds ?? []).map(String)
        : [];
      const rows = await repo.reorderChunks(sourceId, orderedChunkIds);
      res.json(rows.map(chunkDto));
    } catch (error) {
      next(error);
    }
  });

  router.get("/chunks/:id", async (req, res, next) => {
    try {
      const row = await repo.getChunkById(req.params.id);
      if (!row) {
        res.status(404).json({ error: "Chunk not found" });
        return;
      }
      res.json(chunkDto(row));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/chunks/:id", async (req, res, next) => {
    try {
      const updated = await repo.updateChunk(req.params.id, readChunkPatch(req.body as Record<string, unknown>));
      if (!updated) {
        res.status(404).json({ error: "Chunk not found" });
        return;
      }
      res.json(chunkDto(updated));
    } catch (error) {
      next(error);
    }
  });

  router.delete("/chunks/:id", async (req, res, next) => {
    try {
      const deleted = await repo.deleteChunk(req.params.id);
      res.json({ deleted });
    } catch (error) {
      next(error);
    }
  });

  router.get("/chunks/:id/nodes", async (req, res, next) => {
    try {
      const rows = await repo.listNodesForChunk(req.params.id);
      res.json(rows.map(nodeDto));
    } catch (error) {
      next(error);
    }
  });

  router.post("/chunks/:id/nodes", async (req, res, next) => {
    try {
      const created = await repo.createNode(readNodeInput(req.params.id, req.body as Record<string, unknown>));
      res.status(201).json(nodeDto(created));
    } catch (error) {
      next(error);
    }
  });

  router.post("/chunks/:id/nodes/resequence", async (req, res, next) => {
    try {
      const orderedNodeIds = Array.isArray((req.body as { orderedNodeIds?: unknown[] }).orderedNodeIds)
        ? ((req.body as { orderedNodeIds?: unknown[] }).orderedNodeIds ?? []).map(String)
        : [];
      const rows = await repo.resequenceNodes(req.params.id, orderedNodeIds);
      res.json(rows.map(nodeDto));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/nodes/:id", async (req, res, next) => {
    try {
      const updated = await repo.updateNode(req.params.id, readNodePatch(req.body as Record<string, unknown>));
      if (!updated) {
        res.status(404).json({ error: "Node not found" });
        return;
      }
      res.json(nodeDto(updated));
    } catch (error) {
      next(error);
    }
  });

  router.delete("/nodes/:id", async (req, res, next) => {
    try {
      const deleted = await repo.deleteNode(req.params.id);
      res.json({ deleted });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
