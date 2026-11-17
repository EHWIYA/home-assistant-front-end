import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PlugStatus } from "@/api/types";
import { AcPlugCard } from "./AcPlugCard";

vi.mock("@/hooks/useMutationErrorToast", () => ({
  useMutationErrorToast: () => undefined,
}));

type Props = Parameters<typeof AcPlugCard>[0];

function renderWithEnergy(energy: unknown): string {
  const plug: PlugStatus = {
    switch: "on",
    power_w: 3,
    energy_kwh: energy as PlugStatus["energy_kwh"],
    estimated_cost_won: null,
  };
  const mutation = { isPending: false, mutate: vi.fn() };
  const props: Props = {
    plug,
    acState: undefined,
    mutation: mutation as unknown as Props["mutation"],
    recoverMutation: mutation as unknown as Props["recoverMutation"],
  };
  const result = renderToStaticMarkup(createElement(AcPlugCard, props));
  expect(mutation.mutate).not.toHaveBeenCalled();
  return result;
}

describe("스마트 플러그 누적 전력 표시", () => {
  it.each([null, undefined, Number.NaN, Infinity, -Infinity, "missing"])(
    "결측·잘못된 입력 %s은 데이터 없음으로 표시한다",
    (value) => {
      expect(renderWithEnergy(value)).toContain("데이터 없음");
    },
  );

  it("유효한 사용량은 소수 둘째 자리까지 표시한다", () => {
    expect(renderWithEnergy(12.34)).toContain("12.34 kWh");
  });
});
