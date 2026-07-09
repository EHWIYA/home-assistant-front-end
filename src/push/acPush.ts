import { getPwaDisplayMode } from "@/utils/pwaDisplayMode";
import { registerPushToken, unregisterPushToken } from "./api";
import { getPushDeviceLabel, isIosDevice } from "./deviceLabel";
import {
  acquireFcmToken,
  isPushMessagingSupported,
  revokeFcmToken,
} from "./firebase";
import {
  readAcPushEnabled,
  readAcPushToken,
  writeAcPushEnabled,
  writeAcPushRegisteredAt,
  writeAcPushToken,
} from "./storage";

export type AcPushBlockReason =
  | "unsupported"
  | "ios-not-installed"
  | "permission-denied"
  | "no-api-key"
  | "no-sw";

export type AcPushEnableResult =
  | { ok: true; token: string }
  | { ok: false; reason: AcPushBlockReason; message: string };

export type AcPushDisableResult =
  | { ok: true }
  | { ok: false; message: string };

function waitForServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    return Promise.reject(new Error("Service Worker 미지원"));
  }
  return navigator.serviceWorker.ready;
}

export async function checkAcPushPrerequisites(): Promise<AcPushEnableResult | { ok: true }> {
  if (!import.meta.env.VITE_API_KEY) {
    return {
      ok: false,
      reason: "no-api-key",
      message: "VITE_API_KEY가 설정되지 않았습니다.",
    };
  }

  if (!(await isPushMessagingSupported())) {
    return {
      ok: false,
      reason: "unsupported",
      message: "이 브라우저에서는 Web Push를 지원하지 않습니다.",
    };
  }

  if (isIosDevice() && getPwaDisplayMode() !== "standalone") {
    return {
      ok: false,
      reason: "ios-not-installed",
      message:
        "iOS에서는 Safari에서 홈 화면에 추가한 뒤, 앱으로 실행해야 알림을 받을 수 있습니다.",
    };
  }

  if (!("serviceWorker" in navigator)) {
    return {
      ok: false,
      reason: "no-sw",
      message: "Service Worker를 사용할 수 없습니다.",
    };
  }

  return { ok: true };
}

export async function enableAcPushNotifications(): Promise<AcPushEnableResult> {
  const prereq = await checkAcPushPrerequisites();
  if (!prereq.ok) {
    return prereq;
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    return {
      ok: false,
      reason: "permission-denied",
      message: "알림 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.",
    };
  }

  let registration: ServiceWorkerRegistration;
  try {
    registration = await waitForServiceWorker();
  } catch {
    return {
      ok: false,
      reason: "no-sw",
      message: "Service Worker가 아직 준비되지 않았습니다. 잠시 후 다시 시도하세요.",
    };
  }

  const token = await acquireFcmToken(registration);
  await registerPushToken(token, getPushDeviceLabel());
  writeAcPushToken(token);
  writeAcPushEnabled(true);
  writeAcPushRegisteredAt(new Date().toISOString());

  return { ok: true, token };
}

export async function disableAcPushNotifications(): Promise<AcPushDisableResult> {
  const token = readAcPushToken();
  if (token) {
    try {
      await unregisterPushToken(token);
    } catch {
      // NAS에 없는 토큰이어도 로컬은 해제
    }
  }

  await revokeFcmToken();
  writeAcPushToken(null);
  writeAcPushEnabled(false);
  writeAcPushRegisteredAt(null);

  return { ok: true };
}

/** 토큰 재발급·NAS 재등록 (권한 복구·SW 업데이트 후) */
export async function reregisterAcPushNotifications(): Promise<AcPushEnableResult> {
  await disableAcPushNotifications();
  return enableAcPushNotifications();
}

/** 저장된 설정이 ON이면 토큰 재발급·재등록 (SW 업데이트·토큰 갱신 대비) */
export async function syncAcPushIfEnabled(): Promise<void> {
  if (!readAcPushEnabled()) {
    return;
  }

  const prereq = await checkAcPushPrerequisites();
  if (!prereq.ok || Notification.permission !== "granted") {
    return;
  }

  try {
    const registration = await waitForServiceWorker();
    const token = await acquireFcmToken(registration);
    const prev = readAcPushToken();
    if (token !== prev) {
      await registerPushToken(token, getPushDeviceLabel());
      writeAcPushToken(token);
      writeAcPushRegisteredAt(new Date().toISOString());
    }
  } catch {
    // 백그라운드 동기화 실패는 무시
  }
}
