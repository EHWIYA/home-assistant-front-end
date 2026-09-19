import { afterEach, describe, expect, it, vi } from "vitest";
import { getPcNetworkStatusLabel, requestPcWake } from "./pcStatus";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PC boot/network wording", () => {
  it("keeps LAN boot confirmation distinct from plug state", () => {
    expect(getPcNetworkStatusLabel(true, "idle")).toBe("부팅/네트워크 확인됨");
    expect(getPcNetworkStatusLabel(false, "polling")).toContain("패킷 전송됨");
    expect(getPcNetworkStatusLabel(false, "unconfirmed")).toContain(
      "부팅이 아직 확인되지 않았습니다",
    );
    expect(getPcNetworkStatusLabel(false, "idle")).toBe("PC 네트워크 응답 없음");
  });
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
