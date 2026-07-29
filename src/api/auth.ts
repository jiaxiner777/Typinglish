import type { AuthUser } from "../types";
import { request } from "./client";

export function fetchCurrentUser() {
  return request<{ user: AuthUser | null }>("/api/v1/auth/me");
}

export function register(email: string, password: string) {
  return request<{ user: AuthUser }>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function login(email: string, password: string) {
  return request<{ user: AuthUser }>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function logout() {
  return request<{ ok: boolean }>("/api/v1/auth/logout", {
    method: "POST"
  });
}
