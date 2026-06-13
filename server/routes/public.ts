import { Router } from "express";
import { ensureRequestUser } from "../auth.js";
import { chunkDto, nodeDto, progressDto, sourceDto } from "../mappers.js";
import type { Repository } from "../repository.js";
import type { SourceType } from "../types.js";

export function createPublicRouter(repo: Repository, defaultUserId: string) {
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
      const user = await ensureRequestUser(req, repo, defaultUserId);
      const [chunkRows, progressRows] = await Promise.all([repo.getChunksForSource(req.params.id), repo.getProgressForUser(user.id)]);
      const progressByChunk = new Map(progressRows.map((row) => [row.chunk_id, row]));
      const completed = new Set(progressRows.filter((row) => row.is_completed).map((row) => row.chunk_id));

      const chunks = chunkRows.map((chunk) => {
        const progress = progressByChunk.get(chunk.id);
        return {
          ...chunkDto(chunk),
          progress: progress
            ? {
                starsEarned: progress.stars_earned,
                isCompleted: progress.is_completed,
                highestWpm: progress.highest_wpm,
                highestAccuracy: progress.highest_accuracy,
                lastNodeSequence: progress.last_node_sequence
              }
            : {
                starsEarned: 0,
                isCompleted: false,
                highestWpm: 0,
                highestAccuracy: 0,
                lastNodeSequence: 1
              },
          locked: chunk.dependencies.some((id) => !completed.has(id))
        };
      });

      res.json({ sourceId: req.params.id, userId: user.id, chunks });
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
      const user = await ensureRequestUser(req, repo, defaultUserId);
      const payload = req.body as { chunk_id?: string; wpm?: number; accuracy?: number; current_seq?: number };
      if (!payload.chunk_id || typeof payload.wpm !== "number" || typeof payload.accuracy !== "number") {
        res.status(400).json({ error: "chunk_id, wpm and accuracy are required" });
        return;
      }

      const before = await repo.getProgressForUser(user.id);
      const beforeCompleted = new Set(before.filter((row) => row.is_completed).map((row) => row.chunk_id));
      const progress = await repo.reportProgress({
        userId: user.id,
        chunkId: payload.chunk_id,
        wpm: payload.wpm,
        accuracy: payload.accuracy,
        currentSeq: payload.current_seq ?? 1
      });
      const after = await repo.getProgressForUser(user.id);
      const unlockedChunkIds = after.filter((row) => row.is_completed && !beforeCompleted.has(row.chunk_id)).map((row) => row.chunk_id);

      res.json({ progress: progressDto(progress), unlockedChunkIds });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
