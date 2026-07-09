import { compactAcPushAlertForStorage } from "./alertCompact";
import { emitAcPushAlertEvent } from "./alertEvents";
import {
  deleteAllAcPushAlertsFromIdb,
  markAllAcPushAlertsReadInIdb,
  readAcPushAlertFromIdb,
  readAllAcPushAlertsFromIdb,
  updateAcPushAlertReadAtInIdb,
  writeAcPushAlertToIdb,
} from "./alertIdb";
import { parseAcPushAlertFromRecord } from "./alertPayload";
import {
  AC_PUSH_ALERT_HISTORY_KEY,
  AC_PUSH_LAST_ALERT_KEY,
  AC_PUSH_LAST_FINGERPRINT_KEY,
  type AcPushAlert,
} from "./alertTypes";

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeLastFingerprint(fingerprint: string): void {
  try {
    localStorage.setItem(AC_PUSH_LAST_FINGERPRINT_KEY, fingerprint);
  } catch {
    // quota / private mode
  }
}

function readLastFingerprint(): string | null {
  try {
    return localStorage.getItem(AC_PUSH_LAST_FINGERPRINT_KEY);
  } catch {
    return null;
  }
}

function clearLegacyLocalStorage(): void {
  try {
    localStorage.removeItem(AC_PUSH_LAST_ALERT_KEY);
    localStorage.removeItem(AC_PUSH_ALERT_HISTORY_KEY);
  } catch {
    // ignore
  }
}

/** 예전 localStorage 히스토리를 IndexedDB로 1회 이전 */
async function migrateLegacyLocalStorageToIdb(): Promise<void> {
  const legacyHistory = readJson<Record<string, unknown>[]>(AC_PUSH_ALERT_HISTORY_KEY);
  const legacyLast = readJson<Record<string, unknown>>(AC_PUSH_LAST_ALERT_KEY);

  const candidates: Record<string, unknown>[] = [];
  if (legacyLast) {
    candidates.push(legacyLast);
  }
  if (legacyHistory) {
    candidates.push(...legacyHistory);
  }

  for (const raw of candidates) {
    const alert = parseAcPushAlertFromRecord(raw);
    if (alert) {
      try {
        await writeAcPushAlertToIdb(alert);
      } catch {
        // ignore per-item migration failure
      }
    }
  }

  if (candidates.length > 0) {
    clearLegacyLocalStorage();
  }
}

let migrationPromise: Promise<void> | null = null;

function ensureLegacyMigration(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = migrateLegacyLocalStorageToIdb();
  }
  return migrationPromise;
}

export function isAcPushAlertUnread(alert: AcPushAlert): boolean {
  return !alert.readAt;
}

export function countUnreadAcPushAlerts(alerts: AcPushAlert[]): number {
  return alerts.filter(isAcPushAlertUnread).length;
}

export async function loadAcPushAlertHistory(): Promise<AcPushAlert[]> {
  await ensureLegacyMigration();
  try {
    return await readAllAcPushAlertsFromIdb();
  } catch {
    return [];
  }
}

export async function persistAcPushAlert(alert: AcPushAlert): Promise<void> {
  writeLastFingerprint(alert.fingerprint);
  try {
    await writeAcPushAlertToIdb(alert);
    emitAcPushAlertEvent({ type: "saved", alert });
  } catch {
    // SW·foreground 공유 저장 실패 시에도 푸시 수신 자체는 유지
  }
}

export async function markAcPushAlertRead(fingerprint: string): Promise<void> {
  const readAt = new Date().toISOString();
  try {
    await updateAcPushAlertReadAtInIdb(fingerprint, readAt);
    emitAcPushAlertEvent({ type: "read", fingerprint });
  } catch {
    // ignore
  }
}

export async function markAllAcPushAlertsRead(): Promise<void> {
  const readAt = new Date().toISOString();
  try {
    await markAllAcPushAlertsReadInIdb(readAt);
    emitAcPushAlertEvent({ type: "read-all" });
  } catch {
    // ignore
  }
}

export async function resolveAcPushAlert(fingerprint?: string | null): Promise<AcPushAlert | null> {
  await ensureLegacyMigration();

  if (fingerprint) {
    try {
      const fromIdb = await readAcPushAlertFromIdb(fingerprint);
      if (fromIdb) {
        return fromIdb;
      }
    } catch {
      // ignore
    }
    return null;
  }

  const lastFingerprint = readLastFingerprint();
  if (lastFingerprint) {
    try {
      const fromIdb = await readAcPushAlertFromIdb(lastFingerprint);
      if (fromIdb) {
        return fromIdb;
      }
    } catch {
      // ignore
    }
  }

  const history = await loadAcPushAlertHistory();
  return history[0] ?? null;
}

export async function clearAcPushAlertHistory(): Promise<void> {
  clearLegacyLocalStorage();
  try {
    localStorage.removeItem(AC_PUSH_LAST_FINGERPRINT_KEY);
  } catch {
    // ignore
  }
  await deleteAllAcPushAlertsFromIdb();
  emitAcPushAlertEvent({ type: "cleared" });
}

export function estimateAcPushAlertBytes(alert: AcPushAlert): number {
  return JSON.stringify(compactAcPushAlertForStorage(alert)).length;
}
