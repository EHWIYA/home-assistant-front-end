import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
  type Messaging,
} from "firebase/messaging";
import {
  getFirebaseConfig,
  getFirebaseVapidKey,
  isFirebaseConfigured,
} from "./config";

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

export async function isPushMessagingSupported(): Promise<boolean> {
  if (!isFirebaseConfigured()) {
    return false;
  }
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

function getOrInitApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(getFirebaseConfig());
  }
  return app;
}

export function getOrInitMessaging(): Messaging {
  if (!messaging) {
    messaging = getMessaging(getOrInitApp());
  }
  return messaging;
}

export async function acquireFcmToken(
  serviceWorkerRegistration: ServiceWorkerRegistration,
): Promise<string> {
  const msg = getOrInitMessaging();
  const vapidKey = getFirebaseVapidKey();
  if (!vapidKey) {
    throw new Error("VITE_FIREBASE_VAPID_KEY가 설정되지 않았습니다.");
  }

  const token = await getToken(msg, {
    vapidKey,
    serviceWorkerRegistration,
  });

  if (!token) {
    throw new Error("FCM 토큰을 발급하지 못했습니다.");
  }

  return token;
}

export async function revokeFcmToken(): Promise<void> {
  if (!messaging) {
    return;
  }
  try {
    await deleteToken(messaging);
  } catch {
    // 토큰 없음·만료 등
  }
}
