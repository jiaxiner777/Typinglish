import type express from "express";
import type { Repository } from "./repository.js";

export function getRequestUserId(req: express.Request, defaultUserId: string) {
  const headerUserId = req.header("x-typinglish-user-id")?.trim();
  return headerUserId || defaultUserId;
}

export async function ensureRequestUser(req: express.Request, repo: Repository, defaultUserId: string) {
  const userId = getRequestUserId(req, defaultUserId);
  return repo.ensureUser({
    id: userId,
    displayName: userId === defaultUserId ? "Demo User" : "Developer User",
    provider: userId === defaultUserId ? "demo" : "header",
    providerUserId: userId
  });
}

export function requireAdminToken(adminToken: string | null): express.RequestHandler {
  return (req, res, next) => {
    if (!adminToken) {
      next();
      return;
    }

    const token = req.header("x-admin-token")?.trim();
    if (token !== adminToken) {
      res.status(401).json({ error: "Admin token required" });
      return;
    }
    next();
  };
}
