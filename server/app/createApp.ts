import cors from "cors";
import express from "express";
import { requireAdminToken } from "../auth.js";
import type { AppEnv } from "../config/env.js";
import type { Repository } from "../repository.js";
import { createAdminRouter } from "../routes/admin.js";
import { createPublicRouter } from "../routes/public.js";

export function createApp(env: AppEnv, repo: Repository) {
  const app = express();

  app.use(
    cors(
      env.corsOrigins.length === 0
        ? undefined
        : {
            origin(origin, callback) {
              if (!origin || env.corsOrigins.includes(origin)) {
                callback(null, true);
                return;
              }
              callback(new Error(`Origin ${origin} is not allowed by CORS.`));
            }
          }
    )
  );
  app.use(express.json({ limit: "2mb" }));

  app.use("/api/v1", createPublicRouter(repo));
  app.use("/api/admin/v1", requireAdminToken(env.adminToken), createAdminRouter(repo));

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
