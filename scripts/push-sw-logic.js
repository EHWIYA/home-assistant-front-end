/**
 * Service Worker용 공유 로직 — generate-fcm-sw.mjs에서 인라인.
 * 앱 쪽 대응: src/push/alertPayload.ts, alertCompact.ts, alertNavigation.ts
 * topic 기본 경로·알림함 규칙은 alertNavigation.ts 와 반드시 동기화.
 */

var ALERT_DB = "hwiya-ac-push";
var ALERT_STORE = "alerts";
var ALERT_HISTORY_MAX = 30;
var ALERT_BODY_MAX = 1200;
var ALERT_TITLE_MAX = 200;
var ALERT_SUMMARY_JSON_MAX = 4000;
var ALERT_EVENT_CHANNEL = "hwiya-ac-push-alert";

function truncateText(value, max) {
  if (!value || value.length <= max) {
    return value || "";
  }
  return value.slice(0, max) + "…";
}

function pickString(data) {
  var keys = Array.prototype.slice.call(arguments, 1);
  if (!data) {
    return undefined;
  }
  for (var i = 0; i < keys.length; i++) {
    var value = data[keys[i]];
    if (value && String(value).trim()) {
      return String(value).trim();
    }
  }
  return undefined;
}

function createFingerprint(data) {
  var existing = pickString(data, "fingerprint");
  if (existing) {
    return existing;
  }
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "push-" + Date.now();
}

function compactAlertForStorage(alert) {
  var compact = {
    fingerprint: alert.fingerprint,
    title: truncateText(String(alert.title || ""), ALERT_TITLE_MAX),
    body: truncateText(String(alert.body || ""), ALERT_BODY_MAX),
    receivedAt: alert.receivedAt,
  };
  if (alert.topic) compact.topic = alert.topic;
  if (alert.url) compact.url = alert.url;
  if (alert.issueId) compact.issueId = alert.issueId;
  if (alert.status) compact.status = alert.status;
  if (alert.overall) compact.overall = alert.overall;
  if (alert.checkedAtKst) compact.checkedAtKst = alert.checkedAtKst;
  if (alert.llmEscalate) compact.llmEscalate = alert.llmEscalate;
  if (alert.readAt) compact.readAt = alert.readAt;
  if (alert.serverId) compact.serverId = alert.serverId;
  if (alert.summaryJson) {
    compact.summaryJson = truncateText(String(alert.summaryJson), ALERT_SUMMARY_JSON_MAX);
  }
  return compact;
}

function buildAlertFromPayload(payload) {
  var data = payload.data || {};
  var title =
    (payload.notification && payload.notification.title) ||
    pickString(data, "title") ||
    "에어컨 이상";
  var body =
    (payload.notification && payload.notification.body) ||
    pickString(data, "body") ||
    "";
  return {
    fingerprint: createFingerprint(data),
    title: title,
    body: body,
    receivedAt: new Date().toISOString(),
    topic: pickString(data, "topic"),
    url: pickString(data, "url"),
    issueId: pickString(data, "issue_id", "issueId"),
    status: pickString(data, "status"),
    overall: pickString(data, "overall"),
    checkedAtKst: pickString(data, "checked_at_kst", "checkedAtKst"),
    llmEscalate: pickString(data, "llm_escalate", "llmEscalate"),
    summaryJson: pickString(data, "summary"),
  };
}

function resolvePushNavigationPath(alert) {
  var raw = alert.url && String(alert.url).trim();
  if (raw) {
    if (raw.indexOf("http://") === 0 || raw.indexOf("https://") === 0) {
      try {
        var parsed = new URL(raw);
        return parsed.pathname + parsed.search + parsed.hash;
      } catch (_err) {
        /* fall through */
      }
    } else if (raw.charAt(0) === "/") {
      return raw;
    }
  }

  var topic = alert.topic ? String(alert.topic).toLowerCase() : "";
  if (topic === "pc" || topic === "pc-offline") {
    return "/pc";
  }
  if (topic === "strip" || topic === "multitab") {
    return "/strip";
  }
  if (topic === "ac" || topic === "ac-anomaly" || topic === "home") {
    return "/ac";
  }

  var fp = alert.fingerprint;
  return fp ? "/alerts/" + encodeURIComponent(fp) : "/alerts";
}

function broadcastAlertSaved(alert) {
  try {
    var channel = new BroadcastChannel(ALERT_EVENT_CHANNEL);
    channel.postMessage({ type: "saved", alert: alert });
    channel.close();
  } catch (_err) {
    /* BroadcastChannel 미지원 */
  }
}

function openAlertDb() {
  return new Promise(function (resolve, reject) {
    var request = indexedDB.open(ALERT_DB, 1);
    request.onerror = function () {
      reject(request.error);
    };
    request.onsuccess = function () {
      resolve(request.result);
    };
    request.onupgradeneeded = function (event) {
      var db = event.target.result;
      if (!db.objectStoreNames.contains(ALERT_STORE)) {
        db.createObjectStore(ALERT_STORE, { keyPath: "fingerprint" });
      }
    };
  });
}

function pruneAlerts(db) {
  return new Promise(function (resolve, reject) {
    var tx = db.transaction(ALERT_STORE, "readonly");
    var request = tx.objectStore(ALERT_STORE).getAll();
    request.onsuccess = function () {
      var records = request.result || [];
      if (records.length <= ALERT_HISTORY_MAX) {
        resolve();
        return;
      }
      var stale = records
        .slice()
        .sort(function (a, b) {
          return Date.parse(b.receivedAt || 0) - Date.parse(a.receivedAt || 0);
        })
        .slice(ALERT_HISTORY_MAX);
      var pruneTx = db.transaction(ALERT_STORE, "readwrite");
      var store = pruneTx.objectStore(ALERT_STORE);
      for (var i = 0; i < stale.length; i++) {
        var item = stale[i];
        if (item && item.fingerprint) {
          store.delete(item.fingerprint);
        }
      }
      pruneTx.oncomplete = function () {
        resolve();
      };
      pruneTx.onerror = function () {
        reject(pruneTx.error);
      };
    };
    request.onerror = function () {
      reject(request.error);
    };
  });
}

function saveAlertToIdb(alert) {
  var compact = compactAlertForStorage(alert);
  return openAlertDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(ALERT_STORE, "readwrite");
      tx.objectStore(ALERT_STORE).put(compact);
      tx.oncomplete = function () {
        pruneAlerts(db)
          .catch(function () {
            return undefined;
          })
          .finally(function () {
            db.close();
            broadcastAlertSaved(alert);
            resolve();
          });
      };
      tx.onerror = function () {
        db.close();
        reject(tx.error);
      };
    });
  });
}

function buildAlertClickUrl(alert) {
  var path = resolvePushNavigationPath(alert);
  return new URL(path, self.location.origin).href;
}

function handleNotificationClick(event) {
  event.notification.close();
  var data = (event.notification && event.notification.data) || {};
  var alert = {
    fingerprint: data.fingerprint,
    url: data.url,
    topic: data.topic,
  };
  var target = buildAlertClickUrl(alert);
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var client = list[i];
        if (client.url.indexOf(self.location.origin) === 0 && "focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return clients.openWindow(target);
    }),
  );
}
