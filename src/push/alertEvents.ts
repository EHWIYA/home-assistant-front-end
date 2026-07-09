import type { AcPushAlert } from "./alertTypes";

export const AC_PUSH_ALERT_EVENT = "hwiya-ac-push-alert";
export const AC_PUSH_ALERT_CHANNEL = "hwiya-ac-push-alert";

export type AcPushAlertEventType = "saved" | "read" | "read-all" | "cleared" | "synced";

export interface AcPushAlertEventDetail {
  type: AcPushAlertEventType;
  alert?: AcPushAlert;
  fingerprint?: string;
}

let broadcastChannel: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel(AC_PUSH_ALERT_CHANNEL);
  }
  return broadcastChannel;
}

export function emitAcPushAlertEvent(detail: AcPushAlertEventDetail): void {
  window.dispatchEvent(new CustomEvent(AC_PUSH_ALERT_EVENT, { detail }));

  const channel = getBroadcastChannel();
  channel?.postMessage(detail);
}

export function subscribeAcPushAlertEvents(
  listener: (detail: AcPushAlertEventDetail) => void,
): () => void {
  const onWindow = (event: Event) => {
    listener((event as CustomEvent<AcPushAlertEventDetail>).detail);
  };

  window.addEventListener(AC_PUSH_ALERT_EVENT, onWindow);

  const channel = getBroadcastChannel();
  const onChannel = (event: MessageEvent<AcPushAlertEventDetail>) => {
    if (event.data?.type) {
      listener(event.data);
    }
  };
  channel?.addEventListener("message", onChannel);

  return () => {
    window.removeEventListener(AC_PUSH_ALERT_EVENT, onWindow);
    channel?.removeEventListener("message", onChannel);
  };
}
