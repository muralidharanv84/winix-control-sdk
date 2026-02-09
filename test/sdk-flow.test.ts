import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeTargetSpeed,
  defaultWinixDeviceClient,
  resolveWinixSession,
} from "../src/index";
import type { StoredWinixAuthState } from "../src/types";
import { buildJwt } from "./utils";

function authState(): StoredWinixAuthState {
  return {
    userId: "user-1",
    accessToken: buildJwt("user-1"),
    refreshToken: "refresh-1",
    accessExpiresAt: 999999,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sdk integration flow", () => {
  it("resolves session and applies expected airflow target", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ resultCode: "200" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ resultCode: "200" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            resultCode: "200",
            deviceInfoList: [{ deviceId: "device-1", deviceAlias: "Living" }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            body: {
              data: [
                {
                  attributes: { A02: "0", A03: "01", A04: "01" },
                },
              ],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValue(new Response("ok", { status: 200 }));

    const session = await resolveWinixSession("u@example.com", authState());
    const target = computeTargetSpeed(35, "low", 1000, 2000, {
      deadbandUgm3: 2,
      minDwellSeconds: 60,
    });

    expect(session.devices[0]?.deviceId).toBe("device-1");
    expect(target).toBe("turbo");

    const current = await defaultWinixDeviceClient.getState("device-1");
    if (current.power !== "on") await defaultWinixDeviceClient.setPowerOn("device-1");
    if (current.mode !== "manual") await defaultWinixDeviceClient.setModeManual("device-1");
    if (current.airflow !== target) await defaultWinixDeviceClient.setAirflow("device-1", target);

    expect(fetchSpy).toHaveBeenCalled();
    const allUrls = fetchSpy.mock.calls.map((call) => String(call[0]));
    expect(allUrls.some((url) => url.includes("/registerUser"))).toBe(true);
    expect(allUrls.some((url) => url.includes("/A02:1"))).toBe(true);
    expect(allUrls.some((url) => url.includes("/A03:02"))).toBe(true);
    expect(allUrls.some((url) => url.includes("/A04:05"))).toBe(true);
  });
});
