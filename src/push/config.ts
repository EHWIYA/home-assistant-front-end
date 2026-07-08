const PUSH_ORIGIN = "https://iot.iwhya.kr";

export function getFirebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

export function getFirebaseVapidKey(): string {
  return import.meta.env.VITE_FIREBASE_VAPID_KEY ?? "";
}

export function getPushRegisterUrl(): string {
  return (
    import.meta.env.VITE_PUSH_REGISTER_URL ??
    `${PUSH_ORIGIN}/api/push/register`
  );
}

export function getPushUnregisterUrl(): string {
  return (
    import.meta.env.VITE_PUSH_UNREGISTER_URL ??
    `${PUSH_ORIGIN}/api/push/unregister`
  );
}

export function isFirebaseConfigured(): boolean {
  const cfg = getFirebaseConfig();
  return Boolean(
    cfg.apiKey &&
      cfg.authDomain &&
      cfg.projectId &&
      cfg.messagingSenderId &&
      cfg.appId &&
      getFirebaseVapidKey(),
  );
}
