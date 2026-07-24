import { Router } from "express";
import { getRequestIdentity } from "../auth.js";
import { chunkDto, nodeDto, sourceDto } from "../mappers.js";
import { calculateStars, type Repository } from "../repository.js";
import type { SourceType } from "../types.js";

export function createPublicRouter(repo: Repository) {
  const router = Router();

  router.get("/health", async (_req, res) => {
    try {
      await repo.ping();
      res.json({
        ok: true,
        mode: repo.mode,
        architecture: "split",
        database: {
          configured: repo.mode === "postgres",
          ok: true
        }
      });
    } catch (error) {
      console.error(error);
      res.status(503).json({
        ok: false,
        mode: repo.mode,
        architecture: "split",
        database: {
          configured: repo.mode === "postgres",
          ok: false
        },
        error: "Database unavailable"
      });
    }
  });

  router.get("/sources", async (req, res, next) => {
    try {
      const type = req.query.type as SourceType | undefined;
      const rows = await repo.getSources(type);
      res.json(rows.map(sourceDto));
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

  router.get("/sources/:id/map", async (req, res, next) => {
    try {
      const identity = getRequestIdentity(req);
      const chunkRows = await repo.getChunksForSource(req.params.id);

      const chunks = chunkRows.map((chunk) => {
        return {
          ...chunkDto(chunk),
          progress: {
            starsEarned: 0,
            isCompleted: false,
            highestWpm: 0,
            highestAccuracy: 0,
            lastNodeSequence: 1
          },
          locked: chunk.dependencies.length > 0
        };
      });

      res.json({ sourceId: req.params.id, identity, chunks });
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

  router.get("/chunks/:id/stream", async (req, res, next) => {
    try {
      const cursorSeq = Math.max(1, Number(req.query.cursor_seq ?? 1));
      const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 8)));
      const rows = await repo.getNodesForChunk(req.params.id, cursorSeq, limit);
      const nextCursor = rows.length > 0 ? rows[rows.length - 1].sequence + 1 : null;
      res.json({ nodes: rows.map(nodeDto), nextCursor, hasMore: rows.length === limit });
    } catch (error) {
      next(error);
    }
  });

  router.post("/progress/report", async (req, res, next) => {
    try {
      const payload = req.body as { chunk_id?: string; wpm?: number; accuracy?: number; current_seq?: number };
      if (!payload.chunk_id || typeof payload.wpm !== "number" || typeof payload.accuracy !== "number") {
        res.status(400).json({ error: "chunk_id, wpm and accuracy are required" });
        return;
      }
      if (!Number.isFinite(payload.wpm) || payload.wpm < 0 || !Number.isFinite(payload.accuracy) || payload.accuracy < 0 || payload.accuracy > 100) {
        res.status(400).json({ error: "wpm and accuracy must be valid non-negative metrics" });
        return;
      }
      if (payload.current_seq !== undefined && (!Number.isFinite(payload.current_seq) || payload.current_seq < 1)) {
        res.status(400).json({ error: "current_seq must be a positive number" });
        return;
      }

      const identity = getRequestIdentity(req);
      const currentSequence = Math.max(1, Math.floor(payload.current_seq ?? 1));
      const starsEarned = calculateStars(payload.wpm, payload.accuracy);

      res.json({
        identity,
        persisted: false,
        result: {
          chunkId: payload.chunk_id,
          wpm: payload.wpm,
          accuracy: payload.accuracy,
          currentSequence,
          starsEarned,
          isCompleted: starsEarned > 0
        }
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
