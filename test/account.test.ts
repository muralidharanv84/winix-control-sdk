import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveWinixSession } from "../src/account";
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

describe("resolveWinixSession", () => {
  it("registers/checks token and loads devices", async () => {
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
            deviceInfoList: [
              { deviceId: "device-1", deviceAlias: "Living", modelName: "T800" },
              { deviceId: "device-2" },
            ],
          }),
          { status: 200 },
        ),
      );

    const session = await resolveWinixSession("u@example.com", authState());

    expect(session.devices).toEqual([
      { deviceId: "device-1", alias: "Living", model: "T800" },
      { deviceId: "device-2", alias: null, model: null },
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy.mock.calls[0][0]).toContain("/registerUser");
    expect(fetchSpy.mock.calls[1][0]).toContain("/checkAccessToken");
    expect(fetchSpy.mock.calls[2][0]).toContain("/getDeviceInfoList");
  });

  it("throws when Winix resultCode is non-success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ resultCode: "500", resultMessage: "boom" }),
        { status: 200 },
      ),
    );

    await expect(resolveWinixSession("u@example.com", authState())).rejects.toThrow(
      "returned code=500",
    );
  });

  it("throws when API response is non-200", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "bad" }), { status: 401 }),
    );

    await expect(resolveWinixSession("u@example.com", authState())).rejects.toThrow(
      "failed (401)",
    );
  });
});
