/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_KEY?: string;
  readonly VITE_USE_MOCK?: string;
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_VAPID_KEY: string;
  readonly VITE_PUSH_REGISTER_URL?: string;
  readonly VITE_PUSH_UNREGISTER_URL?: string;
  readonly VITE_PUSH_TOKENS_URL?: string;
  readonly VITE_PUSH_TEST_URL?: string;
  readonly VITE_PUSH_STATUS_URL?: string;
  readonly VITE_PUSH_HISTORY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
