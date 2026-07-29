import { Router } from "express";
import bcrypt from "bcryptjs";
import type { AppEnv } from "../config/env.js";
import {
  buildSessionCookie,
  clearSessionCookie,
  createSessionToken,
  getRequestIdentity,
  hashToken,
  sessionExpiryIso,
  SESSION_COOKIE_NAME,
  type AuthenticatedIdentity
} from "../auth.js";
import type { Repository } from "../repository.js";

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed)) return null;
  return trimmed;
}

function validatePassword(password: unknown): string | null {
  if (typeof password !== "string") return null;
  if (password.length < MIN_PASSWORD_LENGTH) return null;
  return password;
}

function publicUser(identity: AuthenticatedIdentity) {
  return {
    id: identity.userId,
    email: identity.email,
    displayName: identity.displayName
  };
}

export function createAuthRouter(env: AppEnv, repo: Repository) {
  const router = Router();

  // POST /api/v1/auth/register
  router.post("/register", async (req, res, next) => {
    try {
      const email = normalizeEmail((req.body as { email?: unknown }).email);
      const password = validatePassword((req.body as { password?: unknown }).password);
      if (!email) {
        res.status(400).json({ error: "A valid email is required" });
        return;
      }
      if (!password) {
        res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
        return;
      }

      const existing = await repo.getUserByEmail(email);
      if (existing) {
        res.status(409).json({ error: "Email already registered" });
        return;
      }

      const passwordHash = bcrypt.hashSync(password, 10);
      const user = await repo.createUser({ email, passwordHash });
      const token = createSessionToken();
      const tokenHash = hashToken(token);
      await repo.createSession({ userId: user.id, tokenHash, expiresAt: sessionExpiryIso() });

      res.setHeader("Set-Cookie", buildSessionCookie(token, env.cookieSecure));
      const identity: AuthenticatedIdentity = {
        kind: "authenticated",
        userId: user.id,
        email: user.email,
        displayName: user.display_name
      };
      res.status(201).json({ user: publicUser(identity) });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/auth/login
  router.post("/login", async (req, res, next) => {
    try {
      const email = normalizeEmail((req.body as { email?: unknown }).email);
      const password = (req.body as { password?: unknown }).password;
      if (!email || typeof password !== "string") {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }

      const user = await repo.getUserByEmail(email);
      // Generic error to avoid leaking whether the email exists
      if (!user || !user.password_hash) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      const valid = bcrypt.compareSync(password, user.password_hash);
      if (!valid) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      const token = createSessionToken();
      const tokenHash = hashToken(token);
      await repo.createSession({ userId: user.id, tokenHash, expiresAt: sessionExpiryIso() });

      res.setHeader("Set-Cookie", buildSessionCookie(token, env.cookieSecure));
      const identity: AuthenticatedIdentity = {
        kind: "authenticated",
        userId: user.id,
        email: user.email,
        displayName: user.display_name
      };
      res.json({ user: publicUser(identity) });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/auth/logout
  router.post("/logout", async (req, res, next) => {
    try {
      const identity = getRequestIdentity(req);
      if (identity.kind === "authenticated") {
        const cookies = req.headers.cookie ?? "";
        const tokenMatch = new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`).exec(cookies);
        if (tokenMatch) {
          const tokenHash = hashToken(tokenMatch[1]);
          await repo.deleteSession(tokenHash);
        }
      }
      res.setHeader("Set-Cookie", clearSessionCookie(env.cookieSecure));
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/auth/me
  router.get("/me", (req, res) => {
    const identity = getRequestIdentity(req);
    if (identity.kind === "anonymous") {
      res.json({ user: null });
      return;
    }
    res.json({ user: publicUser(identity) });
  });

  return router;
}
