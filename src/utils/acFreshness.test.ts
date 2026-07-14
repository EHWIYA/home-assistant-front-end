import { describe, expect, it } from "vitest";
import type { AcStateResponse, StatusResponse } from "@/api/types";
import {
  getAcUncertaintyBannerTitle,
  isAcRunningUncertain,
  mergeStatusFreshness,
  resolveAcRunningConfidence,
  resolvePowerStale,
} from "@/utils/acFreshness";
import { getAcPrimaryStatusLabel } from "@/utils/acMode";
import { getAcRunningBadge } from "@/utils/acRunning";
import { getAcHomePrimaryStatus } from "@/features/home/utils/homeStatus";

function baseStatus(
  overrides: Partial<StatusResponse> & {
    plug?: Partial<StatusResponse["plug"]>;
  } = {},
): StatusResponse {
  const { plug: plugOverride, ...rest } = overrides;
  return {
    plug: {
      switch: "on",
      power_w: 3,
      energy_kwh: 1,
      estimated_cost_won: null,
      power_stale: false,
      power_age_seconds: 10,
      power_updated_at: "2026-07-14T23:00:00+09:00",
      ...plugOverride,
    },
    ac_estimated_running: false,
    ac_running_confidence: "high",
    ac_mode: "off",
    indoor: { temperature: 27, humidity: 50 },
    weather_outdoor: null,
    updated_at: "2026-07-14T23:00:00+09:00",
    ...rest,
  };
}

function baseAcState(
  overrides: Partial<AcStateResponse> = {},
): AcStateResponse {
  return {
    temperature: 27,
    humidity: 50,
    mode: "off",
    auto_enabled: false,
    away_enabled: false,
    power: "off",
    running_source: "plug",
    state_consistent: true,
    state_source: "test",
    power_stale: false,
    ac_running_confidence: "high",
    ...overrides,
  };
}

describe("acFreshness", () => {
  it("power_stale 또는 confidence=low 이면 uncertain", () => {
    const stale = baseStatus({ plug: { power_stale: true } });
    expect(isAcRunningUncertain(stale)).toBe(true);

    const low = baseStatus({ ac_running_confidence: "low" });
    expect(isAcRunningUncertain(low)).toBe(true);

    const high = baseStatus();
    expect(isAcRunningUncertain(high)).toBe(false);
  });

  it("ac/state power_stale를 status보다 우선", () => {
    const status = baseStatus({ plug: { power_stale: false } });
    const ac = baseAcState({ power_stale: true });
    expect(resolvePowerStale(status, ac)).toBe(true);
  });

  it("banner title은 실제 원인만 포함", () => {
    const staleOnly = baseStatus({
      plug: { power_stale: true },
      ac_running_confidence: "medium",
    });
    const title = getAcUncertaintyBannerTitle(staleOnly);
    expect(title).toContain("power_stale");
    expect(title).not.toContain("confidence=low");
    expect(title).toContain("confidence=medium");

    const lowOnly = baseStatus({
      plug: { power_stale: false },
      ac_running_confidence: "low",
    });
    const lowTitle = getAcUncertaintyBannerTitle(lowOnly);
    expect(lowTitle).toContain("confidence=low");
    expect(lowTitle).not.toContain("power_stale");
  });

  it("SSE freshness 누락 시 이전 캐시 병합", () => {
    const previous = baseStatus({
      plug: { power_stale: true, power_age_seconds: 900 },
      ac_running_confidence: "low",
    });
    const sparse = {
      plug: {
        switch: "on",
        power_w: 4,
        energy_kwh: 1,
        estimated_cost_won: null,
      },
      ac_estimated_running: false,
      indoor: { temperature: 27, humidity: 50 },
      weather_outdoor: null,
      updated_at: "2026-07-14T23:05:00+09:00",
    } as StatusResponse;

    const merged = mergeStatusFreshness(previous, sparse);
    expect(merged.plug.power_stale).toBe(true);
    expect(merged.plug.power_age_seconds).toBe(900);
    expect(merged.ac_running_confidence).toBe("low");
    expect(merged.plug.power_w).toBe(4);
  });

  it("confidence resolve는 ac/state 우선", () => {
    const status = baseStatus({ ac_running_confidence: "high" });
    const ac = baseAcState({ ac_running_confidence: "medium" });
    expect(resolveAcRunningConfidence(status, ac)).toBe("medium");
  });
});

describe("running UX — stale/low는 꺼짐 단정 금지", () => {
  it("badge·primary가 확인 중", () => {
    const status = baseStatus({
      plug: { power_stale: true, power_w: 2.7 },
      ac_estimated_running: false,
      ac_running_confidence: "low",
      ac_mode: "off",
    });
    const ac = baseAcState({
      power: "off",
      power_stale: true,
      ac_running_confidence: "low",
    });

    const badge = getAcRunningBadge(
      { mode: "off", power: "off", running_source: "plug" },
      false,
      { uncertain: true },
    );
    expect(badge?.label).toBe("확인 중");

    const label = getAcPrimaryStatusLabel({
      mode: "off",
      power: "off",
      lastRunMode: null,
      operatingMode: "manual",
      isRunning: false,
      isLowPowerRunning: false,
      isUncertain: true,
    });
    expect(label).toBe("확인 중");
    expect(label).not.toContain("꺼짐");

    const home = getAcHomePrimaryStatus(status, ac);
    expect(home.label).toBe("확인 중");
    expect(home.tone).toBe("warn");
  });

  it("medium + logical → 논리 ON(저전력)", () => {
    const badge = getAcRunningBadge(
      { mode: "dry", power: "off", running_source: "logical" },
      false,
      { confidence: "medium" },
    );
    expect(badge?.label).toBe("논리 ON(저전력)");
  });
});
