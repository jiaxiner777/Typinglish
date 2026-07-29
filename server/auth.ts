import { createHash, randomBytes } from "node:crypto";
import type express from "express";
import type { Repository } from "./repository.js";
import type { UserRow } from "./types.js";

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export interface AnonymousIdentity {
  kind: "anonymous";
}

export interface AuthenticatedIdentity {
  kind: "authenticated";
  userId: string;
  email: string | null;
  displayName: string | null;
}

export type Identity = AnonymousIdentity | AuthenticatedIdentity;

const anonymousIdentity: AnonymousIdentity = Object.freeze({ kind: "anonymous" });

/** Extended request type that carries the resolved identity. */
type AuthRequest = express.Request & { identity?: Identity };

export function getRequestIdentity(req: express.Request): Identity {
  return (req as AuthRequest).identity ?? anonymousIdentity;
}

function setIdentity(req: express.Request, identity: Identity): void {
  (req as AuthRequest).identity = identity;
}

// ---------------------------------------------------------------------------
// Session token & cookie utilities
// ---------------------------------------------------------------------------

export const SESSION_COOKIE_NAME = "typinglish_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiryIso(): string {
  return new Date(Date.now() + SESSION_TTL_MS).toISOString();
}

export function buildSessionCookie(token: string, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${SESSION_TTL_MS / 1000}`
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0"
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
  }
  return cookies;
}

function identityFromUser(user: UserRow): AuthenticatedIdentity {
  return {
    kind: "authenticated",
    userId: user.id,
    email: user.email,
    displayName: user.display_name
  };
}

// ---------------------------------------------------------------------------
// Session middleware
// ---------------------------------------------------------------------------

export function createSessionMiddleware(repo: Repository): express.RequestHandler {
  return async (req, _res, next) => {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const token = cookies[SESSION_COOKIE_NAME];
      if (!token) {
        setIdentity(req, anonymousIdentity);
        next();
        return;
      }

      const tokenHash = hashToken(token);
      const session = await repo.getSessionByTokenHash(tokenHash);
      if (!session || new Date(session.expires_at).getTime() < Date.now()) {
        setIdentity(req, anonymousIdentity);
        next();
        return;
      }

      const user = await repo.getUserById(session.user_id);
      if (!user) {
        setIdentity(req, anonymousIdentity);
        next();
        return;
      }

      setIdentity(req, identityFromUser(user));
      next();
    } catch (error) {
      console.error("Session middleware error:", error);
      setIdentity(req, anonymousIdentity);
      next();
    }
  };
}

// ---------------------------------------------------------------------------
// Admin token (unchanged)
// ---------------------------------------------------------------------------

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
