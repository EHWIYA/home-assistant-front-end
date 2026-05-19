import { parseApiErrorBody } from "./errors";
import mockStatus from "./mock/status.json";
import type {
  AcActionRequest,
  OkResponse,
  PlugActionRequest,
  StatusResponse,
} from "./types";

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const apiKey = import.meta.env.VITE_API_KEY;

function useMock(): boolean {
  if (import.meta.env.VITE_USE_MOCK === "true") return true;
  if (import.meta.env.DEV && !baseUrl) return true;
  return false;
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

async function request<T>(
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

export async function fetchStatus(): Promise<StatusResponse> {
  if (useMock()) {
    await new Promise((r) => setTimeout(r, 200));
    return { ...(mockStatus as StatusResponse) };
  }
  return request<StatusResponse>("/api/v1/status");
}

export async function setPlug(action: PlugActionRequest): Promise<void> {
  if (useMock()) {
    await new Promise((r) => setTimeout(r, 300));
    (mockStatus as StatusResponse).plug.switch = action.action;
    return;
  }
  await request("/api/v1/plug", {
    method: "POST",
    body: JSON.stringify(action),
  });
}

export async function setAc(action: AcActionRequest): Promise<OkResponse> {
  if (useMock()) {
    await new Promise((r) => setTimeout(r, 300));
    return { ok: true };
  }
  return request<OkResponse>("/api/v1/ac", {
    method: "POST",
    body: JSON.stringify(action),
  });
}

export function isUsingMock(): boolean {
  return useMock();
}

export function hasApiKey(): boolean {
  return Boolean(apiKey);
}
