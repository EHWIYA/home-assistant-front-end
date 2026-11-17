import { describe, expect, it } from "vitest";
import { formatClimateValue, formatTemperatureHumidity } from "./climate";

describe("기후 센서 표시", () => {
  it("유효한 숫자는 소수 첫째 자리로 표시한다", () => {
    expect(formatClimateValue(24.56)).toBe("24.6");
    expect(formatTemperatureHumidity(24.56, 51)).toBe("24.6°C · 습도 51.0%");
  });

  it.each([null, undefined, Number.NaN, Infinity, -Infinity])(
    "결측·비유한 값 %s을 안전하게 표시한다",
    (value) => {
      expect(formatClimateValue(value)).toBe("—");
      expect(formatTemperatureHumidity(value, value)).toBe("—°C · 습도 —%");
    },
  );
});
