import { afterEach, describe, expect, it, vi } from "vitest";
import type { StatusResponse } from "@/api/types";
import { pollPcBootConfirmation } from "./pcBootConfirmation";

function statusWithNetwork(network_reachable: boolean): StatusResponse {
  return {
    pc: { network_reachable } as StatusResponse["pc"],
  } as StatusResponse;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("pollPcBootConfirmation", () => {
  it("stops as soon as fresh status confirms PC network reachability", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const fetchLatest = vi
      .fn<() => Promise<StatusResponse>>()
      .mockResolvedValueOnce(statusWithNetwork(false))
      .mockResolvedValueOnce(statusWithNetwork(true));

    const resultPromise = pollPcBootConfirmation(fetchLatest);
    await vi.advanceTimersByTimeAsync(3_000);

    await expect(resultPromise).resolves.toBe("confirmed");
    expect(fetchLatest).toHaveBeenCalledTimes(2);
  });

  it("returns timeout after at most 90 seconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const fetchLatest = vi
      .fn<() => Promise<StatusResponse>>()
      .mockResolvedValue(statusWithNetwork(false));

    const resultPromise = pollPcBootConfirmation(fetchLatest);
    await vi.advanceTimersByTimeAsync(90_000);

    await expect(resultPromise).resolves.toBe("timeout");
    expect(fetchLatest).toHaveBeenCalledTimes(31);
  });

  it("keeps status errors unconfirmed and clears its timer when cancelled", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const controller = new AbortController();
    const fetchLatest = vi
      .fn<() => Promise<StatusResponse>>()
      .mockRejectedValue(new Error("status unavailable"));

    const resultPromise = pollPcBootConfirmation(fetchLatest, {
      signal: controller.signal,
    });
    await vi.advanceTimersByTimeAsync(1_000);
    controller.abort();

    await expect(resultPromise).resolves.toBe("cancelled");
    expect(fetchLatest).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
