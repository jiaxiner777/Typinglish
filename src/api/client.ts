const DEFAULT_API_BASE_URL = import.meta.env.DEV ? "http://127.0.0.1:4177" : "";

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  const base = configured && configured.length > 0 ? configured : DEFAULT_API_BASE_URL;
  return base.replace(/\/$/, "");
}

export const API_BASE_URL = resolveApiBaseUrl();

export async function request<T>(path: string, options?: RequestInit, extraHeaders?: Record<string, string>): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set("Content-Type", "application/json");

  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      if (value) headers.set(key, value);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
