import { paths } from "@/routes/paths";
import { buildAlertDetailPath } from "./alertPayload";
import type { AcPushAlert } from "./alertTypes";

type PushNavInput = Pick<AcPushAlert, "fingerprint" | "url" | "topic">;

function normalizeInAppPath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      return parsed.pathname + parsed.search + parsed.hash;
    } catch {
      return null;
    }
  }

  return trimmed.startsWith("/") ? trimmed : null;
}

/** topic 기반 기본 라우트 — url 없을 때 사용.
 *  SW (`scripts/push-sw-logic.js`)와 동일 규칙 유지. 변경 시 양쪽 동기화.
 *  AC topic 기본은 /ac; 레거시 /ac?from=push 는 알림함으로 리다이렉트.
 */
export function resolveTopicDefaultPath(topic?: string): string | null {
  const normalized = topic?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === "pc" || normalized === "pc-offline") {
    return paths.pc;
  }
  if (normalized === "strip" || normalized === "multitab") {
    return paths.strip;
  }
  if (normalized === "ac" || normalized === "ac-anomaly" || normalized === "home") {
    return paths.ac;
  }
  return null;
}

/** FCM data.url + topic + fingerprint 기반 앱 내 경로 */
export function resolvePushNavigationPath(alert: PushNavInput): string {
  const fromUrl = alert.url ? normalizeInAppPath(alert.url) : null;
  if (fromUrl) {
    return fromUrl;
  }

  const fromTopic = resolveTopicDefaultPath(alert.topic);
  if (fromTopic) {
    return fromTopic;
  }

  return alert.fingerprint
    ? buildAlertDetailPath(alert.fingerprint)
    : paths.alerts;
}

/** @deprecated resolvePushNavigationPath 사용 */
export function resolvePushNavigationUrl(
  data: Record<string, string> | undefined,
): string {
  return resolvePushNavigationPath({
    fingerprint: data?.fingerprint ?? "",
    url: data?.url,
    topic: data?.topic,
  });
}
