import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => {
  const auth = { userId: "user", accessToken: "access", idToken: "id", refreshToken: "refresh", accessExpiresAt: 9999999999 };
  return {
    auth,
    session: {
      auth, identityId: "us-east-1:identity",
      devices: [{ deviceId: "living-room", alias: "Living room" }, { deviceId: "bedroom", alias: "Bedroom" }],
    },
    resolveAuth: vi.fn(),
    resolveSession: vi.fn(),
    createClient: vi.fn(),
    client: { getState: vi.fn(), setPowerOn: vi.fn(), setModeManual: vi.fn(), setAirflow: vi.fn() },
  };
});

vi.mock("winix-control-sdk", () => ({
  resolveWinixAuthState: sdk.resolveAuth,
  resolveWinixSession: sdk.resolveSession,
  createWinixDeviceClient: sdk.createClient,
}));

const credentials = { WINIX_USERNAME: "user@example.com", WINIX_PASSWORD: "password" };

afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  sdk.resolveAuth.mockResolvedValue(sdk.auth);
  sdk.resolveSession.mockResolvedValue(sdk.session);
  sdk.createClient.mockReturnValue(sdk.client);
  sdk.client.getState.mockResolvedValue({ power: "off", mode: "auto", airflow: "low" });
});

describe("Node.js CLI example", () => {
  it("lists all devices without sending control commands", async () => {
    const { run } = await import("../examples/node/control.mjs");
    const result = await run([], credentials);
    expect(result.map((device) => device.deviceId)).toEqual(["living-room", "bedroom"]);
    expect(sdk.client.setPowerOn).not.toHaveBeenCalled();
    expect(sdk.client.setModeManual).not.toHaveBeenCalled();
    expect(sdk.client.setAirflow).not.toHaveBeenCalled();
  });

  it("controls only the selected device and reads its resulting state", async () => {
    const { run } = await import("../examples/node/control.mjs");
    sdk.client.getState.mockResolvedValueOnce({ power: "off", mode: "auto", airflow: "low" })
      .mockResolvedValueOnce({ power: "on", mode: "manual", airflow: "high" });
    const result = await run(["bedroom", "high"], credentials);
    expect(sdk.createClient).toHaveBeenCalledWith(sdk.session.identityId);
    expect(sdk.client.setPowerOn.mock.calls).toEqual([["bedroom"]]);
    expect(sdk.client.setModeManual.mock.calls).toEqual([["bedroom"]]);
    expect(sdk.client.setAirflow.mock.calls).toEqual([["bedroom", "high"]]);
    expect(sdk.client.setPowerOn.mock.invocationCallOrder[0]).toBeLessThan(sdk.client.setModeManual.mock.invocationCallOrder[0]);
    expect(sdk.client.setModeManual.mock.invocationCallOrder[0]).toBeLessThan(sdk.client.setAirflow.mock.invocationCallOrder[0]);
    expect(result).toEqual([{ deviceId: "bedroom", alias: "Bedroom", power: "on", mode: "manual", airflow: "high" }]);
  });

  it.each([["living-room"], ["living-room", "invalid"], ["living-room", "high", "extra"]])(
    "rejects invalid command arguments before authenticating: %j", async (...args) => {
      const { run } = await import("../examples/node/control.mjs");
      await expect(run(args, credentials)).rejects.toThrow("Usage:");
      expect(sdk.resolveAuth).not.toHaveBeenCalled();
    },
  );

  it("rejects an unknown device without controlling another device", async () => {
    const { run } = await import("../examples/node/control.mjs");
    await expect(run(["missing", "medium"], credentials)).rejects.toThrow("not found");
    expect(sdk.client.getState).not.toHaveBeenCalled();
    expect(sdk.client.setAirflow).not.toHaveBeenCalled();
  });
});

describe("Lambda example", () => {
  beforeEach(() => {
    vi.stubEnv("WINIX_USERNAME", credentials.WINIX_USERNAME);
    vi.stubEnv("WINIX_PASSWORD", credentials.WINIX_PASSWORD);
    vi.stubEnv("WINIX_DEVICE_ID", "living-room");
  });

  it("reuses cached auth across warm invocations and keeps empty events read-only", async () => {
    const { handler } = await import("../examples/aws-lambda/index.mjs");
    await handler({});
    await handler({});
    expect(sdk.resolveAuth.mock.calls[0][2]).toBeNull();
    expect(sdk.resolveAuth.mock.calls[1][2]).toBe(sdk.auth);
    expect(sdk.client.setPowerOn).not.toHaveBeenCalled();
    expect(sdk.client.setAirflow).not.toHaveBeenCalled();
  });

  it("always controls the configured device even if an event names another", async () => {
    const { handler } = await import("../examples/aws-lambda/index.mjs");
    await handler({ deviceId: "bedroom", speed: "turbo" });
    expect(sdk.client.setAirflow.mock.calls).toEqual([["living-room", "turbo"]]);
  });

  it("clears failed session credentials before the next invocation", async () => {
    const { handler } = await import("../examples/aws-lambda/index.mjs");
    await handler({});
    sdk.resolveSession.mockRejectedValueOnce(new Error("Session invalidated"));
    await expect(handler({})).rejects.toThrow("Session invalidated");
    await handler({});
    expect(sdk.resolveAuth.mock.calls[2][2]).toBeNull();
  });

  it("rejects invalid speed before authenticating", async () => {
    const { handler } = await import("../examples/aws-lambda/index.mjs");
    await expect(handler({ speed: "sleep" })).rejects.toThrow("speed must be");
    expect(sdk.resolveAuth).not.toHaveBeenCalled();
  });
});
