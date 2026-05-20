import { parseApiErrorBody } from "./errors";

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const apiKey = import.meta.env.VITE_API_KEY;

export function shouldUseMock(): boolean {
  if (import.meta.env.VITE_USE_MOCK === "true") return true;
  if (import.meta.env.DEV && !baseUrl) return true;
  return false;
}

export function getApiBaseUrl(): string {
  return baseUrl;
}

export function hasApiKey(): boolean {
  return Boolean(apiKey);
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (apiKey) {
    headers.set("X-API-Key", apiKey);
  }
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const parsed = parseApiErrorBody(text);
    throw new ApiError(
      parsed.message || res.statusText,
      res.status,
      parsed.code,
    );
  }

  return res.json() as Promise<T>;
}

export async function apiRequestNoContent(
  path: string,
  init?: RequestInit,
): Promise<void> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (apiKey) {
    headers.set("X-API-Key", apiKey);
  }
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const parsed = parseApiErrorBody(text);
    throw new ApiError(
      parsed.message || res.statusText,
      res.status,
      parsed.code,
    );
  }
}
