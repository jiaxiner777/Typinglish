import cors from "cors";
import express from "express";
import { resolve } from "node:path";
import { createSessionMiddleware, requireAdminToken } from "../auth.js";
import type { AppEnv } from "../config/env.js";
import type { Repository } from "../repository.js";
import { createAdminRouter } from "../routes/admin.js";
import { createAuthRouter } from "../routes/auth.js";
import { createPublicRouter } from "../routes/public.js";

export function createApp(env: AppEnv, repo: Repository, options: { staticDirectory?: string } = {}) {
  const app = express();
  app.disable("x-powered-by");

  app.use(
    cors(
      env.corsOrigins.length === 0
        ? { origin: env.nodeEnv !== "production", credentials: true }
        : {
            origin(origin, callback) {
              if (!origin || env.corsOrigins.includes(origin)) {
                callback(null, true);
                return;
              }
              callback(new Error(`Origin ${origin} is not allowed by CORS.`));
            },
            credentials: true
          }
    )
  );
  app.use(express.json({ limit: "2mb" }));

  // Session middleware: resolves identity from session cookie before any route
  app.use(createSessionMiddleware(repo));

  app.use("/api/v1/auth", createAuthRouter(env, repo));
  app.use("/api/v1", createPublicRouter(repo));
  app.use("/api/admin/v1", requireAdminToken(env.adminToken), createAdminRouter(repo));

  // Unknown API paths must stay JSON 404s, not return the SPA document.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API route not found" });
  });

  if (env.nodeEnv === "production" || options.staticDirectory) {
    const directory = options.staticDirectory ?? resolve(process.cwd(), "dist");
    app.use(express.static(directory, { index: false }));
    app.get(["/", "/admin", "/admin/"], (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(resolve(directory, "index.html"));
    });
  }

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
