import { apiRequest, shouldUseMock } from "./http";
import mockHolidays from "./mock/holidays.json";
import type { HolidaysResponse } from "./types";

export async function fetchHolidays(year: number): Promise<HolidaysResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 150));
    const data = mockHolidays as HolidaysResponse;
    if (data.year === year) return { ...data, holidays: [...data.holidays] };
    return { year, holidays: [] };
  }
  return apiRequest<HolidaysResponse>(
    `/api/v1/meta/holidays?year=${encodeURIComponent(String(year))}`,
  );
}
