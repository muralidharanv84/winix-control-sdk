import { afterEach, describe, expect, it, vi } from "vitest";
import { createWinixDeviceClient } from "../src/device";
import type { FanSpeed } from "../src/types";

afterEach(() => vi.restoreAllMocks());
const identityId = "us-east-1:test-identity";
const client = createWinixDeviceClient(identityId);

describe("createWinixDeviceClient", () => {
  it("accepts the live control-success message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ headers: { resultMessage: "control success" } }));
    await expect(client.setAirflow("device-1", "low")).resolves.toBeUndefined();
  });
  it("accepts the live S100 response with an empty message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ headers: { resultCode: "S100", resultMessage: "" } }));
    await expect(client.setAirflow("device-1", "low")).resolves.toBeUndefined();
  });

  it("rejects empty messages without a success code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ headers: { resultCode: "E100", resultMessage: "" } }));
    await expect(client.setAirflow("device-1", "low")).rejects.toThrow("Winix device API");
  });
  it.each([
    ["01", "low"], ["02", "medium"], ["03", "high"], ["05", "turbo"], ["06", null],
  ])("reads airflow %s", async (code, speed) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({
      headers: { resultMessage: "success" },
      body: { data: [{ attributes: { A02: "1", A03: "02", A04: code } }] },
    }));
    expect(await client.getState("device-1")).toEqual({ power: "on", mode: "manual", airflow: speed });
  });

  it("reads off/auto state", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({
      headers: { resultMessage: "ok" }, body: { data: [{ attributes: { A02: "0", A03: "01" } }] },
    }));
    expect(await client.getState("device-1")).toEqual({ power: "off", mode: "auto", airflow: null });
  });

  it.each<[FanSpeed, string]>([["low", "01"], ["medium", "02"], ["high", "03"], ["turbo", "05"]])("sets %s with an encoded device and account identity", async (speed, code) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ headers: { resultMessage: "success" } }));
    await client.setAirflow("my device/1?x=y", speed);
    expect(fetchSpy.mock.calls[0][0]).toBe(`https://us.api.winix-iot.com/common/control/devices/my%20device%2F1%3Fx%3Dy/us-east-1:test-identity/A04:${code}`);
  });

  it("keeps identity separate between clients", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({ headers: { resultMessage: "success" } }));
    await client.setPowerOn("device-1");
    await createWinixDeviceClient("other-identity").setModeManual("device-2");
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/us-east-1:test-identity/A02:1");
    expect(String(fetchSpy.mock.calls[1][0])).toContain("/other-identity/A03:02");
  });

  it.each(["no data", "device not connected", "device not registered", "parameter(s) not valid : device id", "unexpected error"])("rejects HTTP-200 device errors: %s", async (message) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ headers: { resultMessage: message } }));
    await expect(client.setAirflow("device-1", "low")).rejects.toThrow(message);
  });

  it("rejects missing response headers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({}));
    await expect(client.getState("device-1")).rejects.toThrow("missing result message");
  });

  it("rejects missing attributes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ headers: { resultMessage: "success" }, body: { data: [{}] } }));
    await expect(client.getState("device-1")).rejects.toThrow("missing attributes");
  });

  it("rejects non-2xx responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("unavailable", { status: 500 }));
    await expect(client.setPowerOn("device-1")).rejects.toThrow("Winix API error 500");
  });

  it("rejects an empty identity", () => {
    expect(() => createWinixDeviceClient(" ")).toThrow("requires an identity ID");
  });
});
