import type express from "express";

export interface AnonymousIdentity {
  kind: "anonymous";
}

const anonymousIdentity: AnonymousIdentity = Object.freeze({ kind: "anonymous" });

export function getRequestIdentity(_req: express.Request): AnonymousIdentity {
  // Authentication will be added through a trusted server-side session. Client
  // headers and request parameters are intentionally not identity sources.
  return anonymousIdentity;
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
