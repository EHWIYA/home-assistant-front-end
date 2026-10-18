import { describe, expect, it } from "vitest";
import { formatExecutedAt } from "./date";

describe("execution time formatting", () => {
  it("always presents execution history in Korea Standard Time", () => {
    const formatted = formatExecutedAt("2026-01-01T00:00:00.000Z");

    expect(formatted).toMatch(/09시 0분 0초/);
    expect(formatted).toMatch(/GMT\+9|KST/);
  });
});
