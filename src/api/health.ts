import { apiRequest, shouldUseMock } from "./http";
import type { HealthResponse } from "./types";

export async function fetchHealth(): Promise<HealthResponse> {
  if (shouldUseMock()) {
    await new Promise((r) => setTimeout(r, 150));
    return { status: "ok", db_reachable: true };
  }
  return apiRequest<HealthResponse>("/health");
}
