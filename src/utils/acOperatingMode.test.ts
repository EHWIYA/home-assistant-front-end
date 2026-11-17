import { describe, expect, it } from "vitest";
import { buildAcPowerOffRequest } from "./acOperatingMode";
import type { AcOperatingMode } from "@/api/types";

describe("에어컨 헤더 전원 끄기", () => {
  it.each<AcOperatingMode | null | undefined>([
    "manual",
    "auto",
    "away",
    null,
    undefined,
  ])("기존 운영 모드가 %s여도 자동 및 외출 제어를 해제한다", (mode) => {
    expect(buildAcPowerOffRequest(mode)).toEqual({
      mode: "off",
      operating_mode: "manual",
      auto_enabled: false,
      away_enabled: false,
    });
  });
});
