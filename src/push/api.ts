import { hasApiKey } from "@/api/http";
import {
  getPushRegisterUrl,
  getPushUnregisterUrl,
} from "./config";

export class PushApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PushApiError";
    this.status = status;
  }
}

function getBearerToken(): string {
  const key = import.meta.env.VITE_API_KEY;
  if (!key) {
    throw new PushApiError("API 키가 설정되지 않았습니다.", 0);
  }
  return key;
}

async function pushRequest(
  url: string,
  init: RequestInit,
): Promise<{ ok: boolean; registered?: number }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${getBearerToken()}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new PushApiError(
      text || res.statusText || "푸시 등록 API 오류",
      res.status,
    );
  }

  return res.json() as Promise<{ ok: boolean; registered?: number }>;
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
