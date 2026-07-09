import { compactAcPushAlertForStorage } from "./alertCompact";
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

async function pruneAcPushAlerts(db: IDBDatabase): Promise<void> {
  const tx = db.transaction(AC_PUSH_IDB_STORE, "readonly");
  const records = await requestToPromise(
    tx.objectStore(AC_PUSH_IDB_STORE).getAll() as IDBRequest<Record<string, unknown>[]>,
  );

  if (records.length <= AC_PUSH_ALERT_HISTORY_MAX) {
    return;
  }

  const stale = records
    .map((record) => parseAcPushAlertFromRecord(record))
    .filter((alert): alert is AcPushAlert => alert !== null)
    .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))
    .slice(AC_PUSH_ALERT_HISTORY_MAX);

  if (stale.length === 0) {
    return;
  }

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

export async function writeAcPushAlertToIdb(alert: AcPushAlert): Promise<void> {
  const db = await openAlertDb();
  try {
    const compact = compactAcPushAlertForStorage(alert);
    const tx = db.transaction(AC_PUSH_IDB_STORE, "readwrite");
    tx.objectStore(AC_PUSH_IDB_STORE).put(compact);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
    });

    await pruneAcPushAlerts(db);
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

export async function deleteAllAcPushAlertsFromIdb(): Promise<void> {
  const db = await openAlertDb();
  try {
    const tx = db.transaction(AC_PUSH_IDB_STORE, "readwrite");
    tx.objectStore(AC_PUSH_IDB_STORE).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB clear failed"));
    });
  } finally {
    db.close();
  }
}

export async function updateAcPushAlertReadAtInIdb(
  fingerprint: string,
  readAt: string,
): Promise<void> {
  const db = await openAlertDb();
  try {
    const tx = db.transaction(AC_PUSH_IDB_STORE, "readwrite");
    const store = tx.objectStore(AC_PUSH_IDB_STORE);
    const record = await requestToPromise(
      store.get(fingerprint) as IDBRequest<Record<string, unknown> | undefined>,
    );
    if (!record) {
      return;
    }
    store.put({ ...record, readAt });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB update failed"));
    });
  } finally {
    db.close();
  }
}

export async function markAllAcPushAlertsReadInIdb(readAt: string): Promise<void> {
  const db = await openAlertDb();
  try {
    const tx = db.transaction(AC_PUSH_IDB_STORE, "readwrite");
    const store = tx.objectStore(AC_PUSH_IDB_STORE);
    const records = await requestToPromise(
      store.getAll() as IDBRequest<Record<string, unknown>[]>,
    );
    for (const record of records) {
      if (!record.readAt) {
        store.put({ ...record, readAt });
      }
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB bulk update failed"));
    });
  } finally {
    db.close();
  }
}
