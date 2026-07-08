import type { MessagePayload } from "firebase/messaging";
import { paths } from "@/routes/paths";
import type { AcPushAlert, AcPushCheckDetail } from "./alertTypes";

function pickString(data: Record<string, string> | undefined, ...keys: string[]): string | undefined {
  if (!data) {
    return undefined;
  }
  for (const key of keys) {
    const value = data[key]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function parseSummary(raw: string | undefined): AcPushCheckDetail[] | undefined {
  if (!raw?.trim()) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return undefined;
    }
    return parsed
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => ({
        name: typeof item.name === "string" ? item.name : undefined,
        status: typeof item.status === "string" ? item.status : undefined,
        detail: typeof item.detail === "string" ? item.detail : undefined,
      }))
      .filter((item) => item.name || item.status || item.detail);
  } catch {
    return undefined;
  }
}

function createFingerprint(data: Record<string, string> | undefined): string {
  const existing = pickString(data, "fingerprint");
  if (existing) {
    return existing;
  }
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `push-${Date.now()}`;
}

export function parseAcPushAlertFromPayload(payload: MessagePayload): AcPushAlert {
  const data = (payload.data ?? {}) as Record<string, string>;
  const title =
    payload.notification?.title?.trim() ||
    pickString(data, "title") ||
    "에어컨 이상";
  const body =
    payload.notification?.body?.trim() ||
    pickString(data, "body") ||
    "";

  return {
    fingerprint: createFingerprint(data),
    title,
    body,
    receivedAt: new Date().toISOString(),
    topic: pickString(data, "topic"),
    url: pickString(data, "url"),
    issueId: pickString(data, "issue_id", "issueId"),
    status: pickString(data, "status"),
    overall: pickString(data, "overall"),
    checkedAtKst: pickString(data, "checked_at_kst", "checkedAtKst"),
    llmEscalate: pickString(data, "llm_escalate", "llmEscalate"),
    summary: parseSummary(pickString(data, "summary")),
  };
}

export function parseAcPushAlertFromRecord(raw: Record<string, unknown>): AcPushAlert | null {
  const fingerprint =
    typeof raw.fingerprint === "string" && raw.fingerprint.trim()
      ? raw.fingerprint.trim()
      : null;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const body = typeof raw.body === "string" ? raw.body : "";
  const receivedAt =
    typeof raw.receivedAt === "string" && raw.receivedAt.trim()
      ? raw.receivedAt.trim()
      : new Date().toISOString();

  if (!fingerprint || !title) {
    return null;
  }

  const summary =
    Array.isArray(raw.summary)
      ? (raw.summary as AcPushCheckDetail[])
      : typeof raw.summaryJson === "string"
        ? parseSummary(raw.summaryJson)
        : undefined;

  return {
    fingerprint,
    title,
    body,
    receivedAt,
    topic: typeof raw.topic === "string" ? raw.topic : undefined,
    url: typeof raw.url === "string" ? raw.url : undefined,
    issueId:
      typeof raw.issueId === "string"
        ? raw.issueId
        : typeof raw.issue_id === "string"
          ? raw.issue_id
          : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
    overall: typeof raw.overall === "string" ? raw.overall : undefined,
    checkedAtKst:
      typeof raw.checkedAtKst === "string"
        ? raw.checkedAtKst
        : typeof raw.checked_at_kst === "string"
          ? raw.checked_at_kst
          : undefined,
    llmEscalate:
      typeof raw.llmEscalate === "string"
        ? raw.llmEscalate
        : typeof raw.llm_escalate === "string"
          ? raw.llm_escalate
          : undefined,
    summary,
  };
}

export function buildAlertDetailPath(fingerprint: string): string {
  return paths.alertDetail(fingerprint);
}

/** @deprecated buildAlertDetailPath 사용 */
export function buildAcPushDetailPath(fingerprint: string): string {
  return buildAlertDetailPath(fingerprint);
}

export function normalizeNotificationBody(body: string): string {
  return body.replace(/\\n/g, "\n");
}
