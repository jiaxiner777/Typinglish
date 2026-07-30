import { Router } from "express";
import { evaluateAdventureAttempt, resolveAdventureConfig, type AdventureInputMode, type AttemptMetrics } from "../../shared/adventure/evaluator.js";
import { getRequestIdentity } from "../auth.js";
import { chunkDto, nodeDto, progressDto, sourceDto } from "../mappers.js";
import type { Repository } from "../repository.js";
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

      // Load progress for authenticated users; anonymous gets zero progress
      let progressMap: Map<string, ReturnType<typeof progressDto>> = new Map();
      if (identity.kind === "authenticated") {
        const progressRows = await repo.getProgressForUser(identity.userId);
        progressMap = new Map(progressRows.map((row) => [row.chunk_id, progressDto(row)]));
      }

      const completedIds = new Set(
        [...progressMap.values()].filter((progress) => progress.isCompleted).map((progress) => progress.chunkId)
      );
      const chunks = chunkRows.map((chunk) => {
        const progress = progressMap.get(chunk.id);
        return {
          ...chunkDto(chunk),
          progress: progress
            ? {
                starsEarned: progress.starsEarned,
                isCompleted: progress.isCompleted,
                highestWpm: progress.highestWpm,
                highestAccuracy: progress.highestAccuracy,
                lastNodeSequence: progress.lastNodeSequence
              }
            : {
                starsEarned: 0,
                isCompleted: false,
                highestWpm: 0,
                highestAccuracy: 0,
                lastNodeSequence: 1
              },
          locked: chunk.dependencies.some((dependencyId) => !completedIds.has(dependencyId))
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
      const payload = req.body as {
        chunk_id?: string;
        wpm?: number;
        accuracy?: number;
        error_count?: number;
        elapsed_seconds?: number;
        input_mode?: AdventureInputMode;
        completed?: boolean;
        timed_out?: boolean;
        current_seq?: number;
      };
      if (
        !payload.chunk_id ||
        typeof payload.wpm !== "number" ||
        typeof payload.accuracy !== "number" ||
        typeof payload.error_count !== "number" ||
        typeof payload.elapsed_seconds !== "number" ||
        (payload.input_mode !== "STRICT" && payload.input_mode !== "TOLERANT") ||
        typeof payload.completed !== "boolean" ||
        typeof payload.timed_out !== "boolean"
      ) {
        res.status(400).json({ error: "A complete Adventure attempt payload is required" });
        return;
      }
      if (
        !Number.isFinite(payload.wpm) ||
        payload.wpm < 0 ||
        !Number.isFinite(payload.accuracy) ||
        payload.accuracy < 0 ||
        payload.accuracy > 100 ||
        !Number.isFinite(payload.error_count) ||
        payload.error_count < 0 ||
        !Number.isFinite(payload.elapsed_seconds) ||
        payload.elapsed_seconds < 0
      ) {
        res.status(400).json({ error: "Attempt metrics must be finite and within their valid ranges" });
        return;
      }
      if (payload.current_seq !== undefined && (!Number.isFinite(payload.current_seq) || payload.current_seq < 1)) {
        res.status(400).json({ error: "current_seq must be a positive number" });
        return;
      }

      const identity = getRequestIdentity(req);
      const currentSequence = Math.max(1, Math.floor(payload.current_seq ?? 1));
      const chunk = await repo.getChunkById(payload.chunk_id);
      if (!chunk) {
        res.status(404).json({ error: "Chunk not found" });
        return;
      }
      const nodes = await repo.listNodesForChunk(chunk.id);
      const textLength = nodes.map((node) => node.raw_text).join(" ").length;
      const config = resolveAdventureConfig(chunk.metadata ?? {}, textLength);
      const metrics: AttemptMetrics = {
        wpm: payload.wpm,
        accuracy: payload.accuracy,
        errorCount: Math.floor(payload.error_count),
        elapsedSeconds: payload.elapsed_seconds,
        inputMode: payload.input_mode,
        completed: payload.completed,
        timedOut: payload.timed_out
      };
      const evaluation = evaluateAdventureAttempt(config, metrics);

      const attemptResult = {
        chunkId: chunk.id,
        wpm: metrics.wpm,
        accuracy: metrics.accuracy,
        errorCount: metrics.errorCount,
        elapsedSeconds: metrics.elapsedSeconds,
        inputMode: metrics.inputMode,
        completed: metrics.completed,
        timedOut: metrics.timedOut,
        currentSequence,
        passed: evaluation.passed,
        failureReason: evaluation.failureReason,
        nextStarHint: evaluation.nextStarHint
      };

      // Anonymous: do not write to repository
      if (identity.kind === "anonymous") {
        res.json({
          identity,
          persisted: false,
          result: {
            ...attemptResult,
            starsEarned: evaluation.stars,
            isCompleted: evaluation.passed
          }
        });
        return;
      }

      const userProgress = await repo.getProgressForUser(identity.userId);
      const completedIds = new Set(userProgress.filter((row) => row.is_completed).map((row) => row.chunk_id));
      if (chunk.dependencies.some((dependencyId) => !completedIds.has(dependencyId))) {
        res.status(409).json({ error: "Chunk dependencies are not completed" });
        return;
      }

      const persisted = await repo.reportProgress({
        userId: identity.userId,
        chunkId: payload.chunk_id,
        wpm: payload.wpm,
        accuracy: payload.accuracy,
        currentSeq: currentSequence,
        starsEarned: evaluation.stars,
        passed: evaluation.passed
      });

      res.json({
        identity,
        persisted: true,
        result: {
          ...attemptResult,
          starsEarned: persisted.stars_earned,
          isCompleted: persisted.is_completed
        }
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
