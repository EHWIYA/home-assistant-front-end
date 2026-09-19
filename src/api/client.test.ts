import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("wakePc", () => {
  it("posts to the dedicated authenticated wake endpoint without plug action data", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://iot-api.test");
    vi.stubEnv("VITE_API_KEY", "test-key");
    vi.stubEnv("VITE_USE_MOCK", "false");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { wakePc } = await import("./client");
    const response = await wakePc();

    expect(response).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://iot-api.test/api/v1/pc/wake");
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).get("X-API-Key")).toBe("test-key");
  });
});
