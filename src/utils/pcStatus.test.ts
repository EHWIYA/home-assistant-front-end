import { afterEach, describe, expect, it, vi } from "vitest";
import { requestPcWake } from "./pcStatus";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PC Wake-on-LAN confirmation", () => {
  it("does not send a packet when the user cancels", () => {
    const confirm = vi.fn().mockReturnValue(false);
    const send = vi.fn();
    vi.stubGlobal("window", { confirm });

    requestPcWake(send);

    expect(send).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm.mock.calls[0][0]).toContain("PC가 꺼져 있을 때");
    expect(confirm.mock.calls[0][0]).toContain("깨우기 패킷만");
  });

  it("sends one packet after confirmation", () => {
    const confirm = vi.fn().mockReturnValue(true);
    const send = vi.fn();
    vi.stubGlobal("window", { confirm });

    requestPcWake(send);

    expect(send).toHaveBeenCalledOnce();
  });
});
