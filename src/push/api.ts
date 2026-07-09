import { hasApiKey } from "@/api/http";
import {
  getPushHistoryUrl,
  getPushRegisterUrl,
  getPushStatusUrl,
  getPushTestUrl,
  getPushTokensUrl,
  getPushUnregisterUrl,
} from "./config";
import { parseAcPushAlertFromRecord } from "./alertPayload";
import type { AcPushAlert } from "./alertTypes";

export class PushApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PushApiError";
    this.status = status;
  }
}

export interface PushTokenRecord {
  token: string;
  label: string;
  enabled: boolean;
  registeredAt?: string;
  lastSeenAt?: string;
}

export interface PushStatusResponse {
  ok: boolean;
  enabled?: boolean;
  nextAllowedAt?: string;
  lastSentAt?: string;
}

export interface PushHistoryRecord {
  id?: string;
  fingerprint: string;
  title: string;
  body: string;
  receivedAt: string;
  topic?: string;
  url?: string;
  issueId?: string;
  status?: string;
  overall?: string;
  checkedAtKst?: string;
  llmEscalate?: string;
  summary?: string;
}

function getBearerToken(): string {
  const key = import.meta.env.VITE_API_KEY;
  if (!key) {
    throw new PushApiError("API 키가 설정되지 않았습니다.", 0);
  }
  return key;
}

async function pushRequest<T>(
  url: string,
  init: RequestInit,
  options?: { allowNotFound?: boolean },
): Promise<T | null> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${getBearerToken()}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (options?.allowNotFound && (res.status === 404 || res.status === 501)) {
    return null;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new PushApiError(
      text || res.statusText || "푸시 API 오류",
      res.status,
    );
  }

  if (res.status === 204) {
    return null;
  }

  return res.json() as Promise<T>;
}

export async function registerPushToken(
  token: string,
  label: string,
): Promise<void> {
  if (!hasApiKey()) {
    throw new PushApiError("API 키가 설정되지 않았습니다.", 0);
  }
  await pushRequest(getPushRegisterUrl(), {
    method: "POST",
    body: JSON.stringify({ token, label, enabled: true }),
  });
}

export async function unregisterPushToken(token: string): Promise<void> {
  if (!hasApiKey()) {
    throw new PushApiError("API 키가 설정되지 않았습니다.", 0);
  }
  await pushRequest(getPushUnregisterUrl(), {
    method: "DELETE",
    body: JSON.stringify({ token }),
  });
}

export async function listPushTokens(): Promise<PushTokenRecord[] | null> {
  if (!hasApiKey()) {
    return null;
  }
  try {
    const data = await pushRequest<{ tokens?: PushTokenRecord[] }>(
      getPushTokensUrl(),
      { method: "GET" },
      { allowNotFound: true },
    );
    return data?.tokens ?? [];
  } catch {
    return null;
  }
}

export type PushActionResult =
  | { ok: true }
  | { ok: false; error: string };

function pushActionError(err: unknown, fallback: string): string {
  if (err instanceof PushApiError) {
    return err.message || fallback;
  }
  return fallback;
}

export async function deleteRemotePushToken(token: string): Promise<PushActionResult> {
  if (!hasApiKey()) {
    return { ok: false, error: "API 키가 설정되지 않았습니다." };
  }
  try {
    await pushRequest(getPushUnregisterUrl(), {
      method: "DELETE",
      body: JSON.stringify({ token }),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: pushActionError(err, "기기 해제에 실패했습니다.") };
  }
}

export async function sendTestPush(): Promise<PushActionResult> {
  if (!hasApiKey()) {
    return { ok: false, error: "API 키가 설정되지 않았습니다." };
  }
  try {
    await pushRequest(getPushTestUrl(), { method: "POST", body: "{}" });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: pushActionError(err, "테스트 푸시 요청에 실패했습니다.") };
  }
}

export async function fetchPushStatus(): Promise<PushStatusResponse | null> {
  if (!hasApiKey()) {
    return null;
  }
  try {
    return await pushRequest<PushStatusResponse>(
      getPushStatusUrl(),
      { method: "GET" },
      { allowNotFound: true },
    );
  } catch {
    return null;
  }
}

export async function fetchPushHistory(limit = 30): Promise<PushHistoryRecord[] | null> {
  if (!hasApiKey()) {
    return null;
  }
  try {
    const url = new URL(getPushHistoryUrl());
    url.searchParams.set("limit", String(limit));
    const data = await pushRequest<{ alerts?: PushHistoryRecord[] }>(
      url.toString(),
      { method: "GET" },
      { allowNotFound: true },
    );
    return data?.alerts ?? [];
  } catch {
    return null;
  }
}

export function mapPushHistoryRecordToAlert(record: PushHistoryRecord): AcPushAlert | null {
  const raw: Record<string, unknown> = {
    fingerprint: record.fingerprint,
    title: record.title,
    body: record.body,
    receivedAt: record.receivedAt,
    topic: record.topic,
    url: record.url,
    issueId: record.issueId,
    status: record.status,
    overall: record.overall,
    checkedAtKst: record.checkedAtKst,
    llmEscalate: record.llmEscalate,
    serverId: record.id,
    summaryJson: record.summary,
  };
  return parseAcPushAlertFromRecord(raw);
}
