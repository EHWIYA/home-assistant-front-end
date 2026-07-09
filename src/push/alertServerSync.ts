import { fetchPushHistory, mapPushHistoryRecordToAlert } from "./api";
import { emitAcPushAlertEvent } from "./alertEvents";
import { writeAcPushAlertToIdb, readAcPushAlertFromIdb } from "./alertIdb";
import type { AcPushAlert } from "./alertTypes";

let syncPromise: Promise<void> | null = null;

/** NAS 히스토리 → IndexedDB 병합 (API 미구현 시 no-op) */
export async function syncPushHistoryFromServer(): Promise<boolean> {
  if (syncPromise) {
    await syncPromise;
    return false;
  }

  syncPromise = (async () => {
    const records = await fetchPushHistory();
    if (!records || records.length === 0) {
      return;
    }

    for (const record of records) {
      const incoming = mapPushHistoryRecordToAlert(record);
      if (!incoming) {
        continue;
      }

      try {
        const existing = await readAcPushAlertFromIdb(incoming.fingerprint);
        const merged: AcPushAlert = existing
          ? {
              ...incoming,
              readAt: existing.readAt,
              body: existing.body || incoming.body,
              summary: existing.summary ?? incoming.summary,
            }
          : incoming;
        await writeAcPushAlertToIdb(merged);
      } catch {
        // per-item ignore
      }
    }

    emitAcPushAlertEvent({ type: "synced" });
  })();

  try {
    await syncPromise;
    return true;
  } catch {
    return false;
  } finally {
    syncPromise = null;
  }
}
