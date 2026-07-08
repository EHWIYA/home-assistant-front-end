import {
  readAcPushAlertFromIdb,
  readAllAcPushAlertsFromIdb,
  writeAcPushAlertToIdb,
} from "./alertIdb";
import { parseAcPushAlertFromRecord } from "./alertPayload";
import {
  AC_PUSH_ALERT_HISTORY_KEY,
  AC_PUSH_ALERT_HISTORY_MAX,
  AC_PUSH_LAST_ALERT_KEY,
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

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota / private mode
  }
}

function upsertHistory(history: AcPushAlert[], alert: AcPushAlert): AcPushAlert[] {
  const next = [alert, ...history.filter((item) => item.fingerprint !== alert.fingerprint)];
  return next
    .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))
    .slice(0, AC_PUSH_ALERT_HISTORY_MAX);
}

export function readLastAcPushAlert(): AcPushAlert | null {
  const raw = readJson<Record<string, unknown>>(AC_PUSH_LAST_ALERT_KEY);
  if (!raw) {
    return null;
  }
  return parseAcPushAlertFromRecord(raw);
}

export function readAcPushAlertHistory(): AcPushAlert[] {
  const raw = readJson<Record<string, unknown>[]>(AC_PUSH_ALERT_HISTORY_KEY);
  if (!raw) {
    return [];
  }
  return raw
    .map((item) => parseAcPushAlertFromRecord(item))
    .filter((item): item is AcPushAlert => item !== null)
    .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
}

export function findAcPushAlertInLocal(fingerprint: string): AcPushAlert | null {
  const history = readAcPushAlertHistory();
  return history.find((item) => item.fingerprint === fingerprint) ?? null;
}

export async function persistAcPushAlert(alert: AcPushAlert): Promise<void> {
  writeJson(AC_PUSH_LAST_ALERT_KEY, alert);
  writeJson(AC_PUSH_ALERT_HISTORY_KEY, upsertHistory(readAcPushAlertHistory(), alert));
  try {
    await writeAcPushAlertToIdb(alert);
  } catch {
    // SW·foreground 공유 저장 실패는 localStorage만으로도 P0 동작
  }
}

export async function resolveAcPushAlert(fingerprint?: string | null): Promise<AcPushAlert | null> {
  if (fingerprint) {
    const fromLocal = findAcPushAlertInLocal(fingerprint);
    if (fromLocal) {
      return fromLocal;
    }
    try {
      const fromIdb = await readAcPushAlertFromIdb(fingerprint);
      if (fromIdb) {
        writeJson(AC_PUSH_LAST_ALERT_KEY, fromIdb);
        writeJson(AC_PUSH_ALERT_HISTORY_KEY, upsertHistory(readAcPushAlertHistory(), fromIdb));
        return fromIdb;
      }
    } catch {
      // ignore
    }
    return null;
  }

  return readLastAcPushAlert();
}

/** SW IndexedDB에만 있는 항목을 설정 화면 히스토리에 반영 */
export async function mergeAcPushAlertHistoryFromIdb(): Promise<AcPushAlert[]> {
  const local = readAcPushAlertHistory();
  try {
    const fromIdb = await readAllAcPushAlertsFromIdb();
    let merged = local;
    for (const alert of fromIdb) {
      merged = upsertHistory(merged, alert);
    }
    writeJson(AC_PUSH_ALERT_HISTORY_KEY, merged);
    return merged;
  } catch {
    return local;
  }
}
