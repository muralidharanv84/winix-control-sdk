import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultWinixDeviceClient } from "../src/device";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("defaultWinixDeviceClient", () => {
  it("parses state payload", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          headers: { resultMessage: "ok" },
          body: {
            data: [
              {
                attributes: {
                  A02: "1",
                  A03: "02",
                  A04: "03",
                },
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const state = await defaultWinixDeviceClient.getState("device-1");
    expect(state).toEqual({
      power: "on",
      mode: "manual",
      airflow: "high",
    });
  });

  it("returns null airflow for unknown code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          body: {
            data: [
              {
                attributes: {
                  A02: "1",
                  A03: "02",
                  A04: "99",
                },
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const state = await defaultWinixDeviceClient.getState("device-1");
    expect(state.airflow).toBeNull();
  });

  it("throws when state endpoint returns no data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ headers: { resultMessage: "No Data" } }),
        { status: 200 },
      ),
    );

    await expect(defaultWinixDeviceClient.getState("device-1")).rejects.toThrow(
      "returned no data",
    );
  });

  it("throws when attributes are missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ body: { data: [{}] } }), { status: 200 }),
    );

    await expect(defaultWinixDeviceClient.getState("device-1")).rejects.toThrow(
      "missing attributes",
    );
  });

  it("encodes device ids in control URLs", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("ok", { status: 200 }),
    );

    await defaultWinixDeviceClient.setAirflow("my device/1?x=y", "turbo");

    const calledUrl = String(fetchSpy.mock.calls[0][0]);
    expect(calledUrl).toContain("my%20device%2F1%3Fx%3Dy");
    expect(calledUrl).toContain("/A04:05");
  });

  it("throws on non-2xx device API responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("bad", { status: 500 }),
    );

    await expect(defaultWinixDeviceClient.setPowerOn("device-1")).rejects.toThrow(
      "Winix API error 500",
    );
  });
});
