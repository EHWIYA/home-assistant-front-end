import { parseAcPushAlertFromRecord } from "./alertPayload";
import {
  AC_PUSH_ALERT_HISTORY_MAX,
  AC_PUSH_IDB_NAME,
  AC_PUSH_IDB_STORE,
  type AcPushAlert,
} from "./alertTypes";

function openAlertDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AC_PUSH_IDB_NAME, 1);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(AC_PUSH_IDB_STORE)) {
        db.createObjectStore(AC_PUSH_IDB_STORE, { keyPath: "fingerprint" });
      }
    };
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export async function writeAcPushAlertToIdb(alert: AcPushAlert): Promise<void> {
  const db = await openAlertDb();
  try {
    const tx = db.transaction(AC_PUSH_IDB_STORE, "readwrite");
    tx.objectStore(AC_PUSH_IDB_STORE).put(alert);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
    });

    const all = await readAllAcPushAlertsFromIdb();
    if (all.length > AC_PUSH_ALERT_HISTORY_MAX) {
      const stale = all
        .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))
        .slice(AC_PUSH_ALERT_HISTORY_MAX);
      const pruneTx = db.transaction(AC_PUSH_IDB_STORE, "readwrite");
      const store = pruneTx.objectStore(AC_PUSH_IDB_STORE);
      for (const item of stale) {
        store.delete(item.fingerprint);
      }
      await new Promise<void>((resolve, reject) => {
        pruneTx.oncomplete = () => resolve();
        pruneTx.onerror = () => reject(pruneTx.error ?? new Error("IndexedDB prune failed"));
      });
    }
  } finally {
    db.close();
  }
}

export async function readAcPushAlertFromIdb(fingerprint: string): Promise<AcPushAlert | null> {
  const db = await openAlertDb();
  try {
    const tx = db.transaction(AC_PUSH_IDB_STORE, "readonly");
    const record = await requestToPromise(
      tx.objectStore(AC_PUSH_IDB_STORE).get(fingerprint) as IDBRequest<Record<string, unknown>>,
    );
    if (!record) {
      return null;
    }
    return parseAcPushAlertFromRecord(record);
  } finally {
    db.close();
  }
}

export async function readAllAcPushAlertsFromIdb(): Promise<AcPushAlert[]> {
  const db = await openAlertDb();
  try {
    const tx = db.transaction(AC_PUSH_IDB_STORE, "readonly");
    const records = await requestToPromise(
      tx.objectStore(AC_PUSH_IDB_STORE).getAll() as IDBRequest<Record<string, unknown>[]>,
    );
    return records
      .map((record) => parseAcPushAlertFromRecord(record))
      .filter((alert): alert is AcPushAlert => alert !== null)
      .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
  } catch {
    return [];
  } finally {
    db.close();
  }
}
