import cors from "cors";
import express from "express";
import { chunkDto, nodeDto, progressDto, sourceDto } from "./mappers";
import { createRepository, demoUserId } from "./repository";
import type { SourceType } from "./types";

const app = express();
const repo = createRepository();
const port = Number(process.env.PORT ?? 4177);

app.use(cors());
app.use(express.json());

app.get("/api/v1/health", (_req, res) => {
  res.json({ ok: true, mode: process.env.DATABASE_URL ? "postgres" : "memory" });
});

app.get("/api/v1/sources", async (req, res, next) => {
  try {
    const type = req.query.type as SourceType | undefined;
    const rows = await repo.getSources(type);
    res.json(rows.map(sourceDto));
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1/sources/:id/map", async (req, res, next) => {
  try {
    const [chunkRows, progressRows] = await Promise.all([
      repo.getChunksForSource(req.params.id),
      repo.getProgressForUser(demoUserId)
    ]);
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

    res.json({ sourceId: req.params.id, chunks });
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1/chunks/:id/stream", async (req, res, next) => {
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

app.post("/api/v1/progress/report", async (req, res, next) => {
  try {
    const payload = req.body as { chunk_id?: string; wpm?: number; accuracy?: number; current_seq?: number };
    if (!payload.chunk_id || typeof payload.wpm !== "number" || typeof payload.accuracy !== "number") {
      res.status(400).json({ error: "chunk_id, wpm and accuracy are required" });
      return;
    }

    const before = await repo.getProgressForUser(demoUserId);
    const beforeCompleted = new Set(before.filter((row) => row.is_completed).map((row) => row.chunk_id));
    const progress = await repo.reportProgress({
      userId: demoUserId,
      chunkId: payload.chunk_id,
      wpm: payload.wpm,
      accuracy: payload.accuracy,
      currentSeq: payload.current_seq ?? 1
    });
    const after = await repo.getProgressForUser(demoUserId);
    const unlockedChunkIds = after
      .filter((row) => row.is_completed && !beforeCompleted.has(row.chunk_id))
      .map((row) => row.chunk_id);

    res.json({ progress: progressDto(progress), unlockedChunkIds });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Typinglish API listening on http://127.0.0.1:${port}`);
});
