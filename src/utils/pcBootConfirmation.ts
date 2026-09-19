import type { StatusResponse } from "@/api/types";

export const PC_BOOT_CONFIRMATION_TIMEOUT_MS = 90_000;
export const PC_BOOT_CONFIRMATION_POLL_INTERVAL_MS = 3_000;

export type PcBootConfirmationState =
  | "idle"
  | "polling"
  | "confirmed"
  | "unconfirmed";

export type PcBootPollResult = "confirmed" | "timeout" | "cancelled";

interface PollPcBootOptions {
  timeoutMs?: number;
  intervalMs?: number;
  signal?: AbortSignal;
  now?: () => number;
}

function waitFor(ms: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);

  return new Promise((resolve) => {
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve(true);
    }, ms);
    const onAbort = () => {
      globalThis.clearTimeout(timer);
      resolve(false);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function pollPcBootConfirmation(
  fetchLatestStatus: () => Promise<StatusResponse>,
  {
    timeoutMs = PC_BOOT_CONFIRMATION_TIMEOUT_MS,
    intervalMs = PC_BOOT_CONFIRMATION_POLL_INTERVAL_MS,
    signal,
    now = Date.now,
  }: PollPcBootOptions = {},
): Promise<PcBootPollResult> {
  const startedAt = now();

  while (!signal?.aborted) {
    try {
      const status = await fetchLatestStatus();
      if (status.pc?.network_reachable === true) return "confirmed";
    } catch {
      // WoL 패킷 전송 성공과 상태 조회 실패를 분리한다.
    }

    const remainingMs = timeoutMs - (now() - startedAt);
    if (remainingMs <= 0) return "timeout";
    const completed = await waitFor(Math.min(intervalMs, remainingMs), signal);
    if (!completed) return "cancelled";
  }

  return "cancelled";
}
