import { apiRequest, shouldUseMock } from "./http";
import mockHolidays from "./mock/holidays.json";
import type { HolidaysResponse } from "./types";

export function holidayDates(response: HolidaysResponse | undefined): string[] {
  return response?.dates ?? [];
}

export async function fetchHolidays(year: number): Promise<HolidaysResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 150));
    const data = mockHolidays as HolidaysResponse;
    if (data.year === year) {
      return { ...data, dates: [...data.dates] };
    }
    return { year, dates: [] };
  }
  return apiRequest<HolidaysResponse>(
    `/api/v1/meta/holidays?year=${encodeURIComponent(String(year))}`,
  );
}
