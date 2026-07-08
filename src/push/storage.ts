const ENABLED_KEY = "hwiya-ac-push-enabled";
const TOKEN_KEY = "hwiya-ac-push-token";

export function readAcPushEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeAcPushEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(ENABLED_KEY, "1");
    } else {
      localStorage.removeItem(ENABLED_KEY);
    }
  } catch {
    // ignore quota / private mode
  }
}

export function readAcPushToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeAcPushToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}
