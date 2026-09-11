import type { FanSpeed, WinixDeviceState } from "./types.js";

const STATE_URL =
  "https://us.api.winix-iot.com/common/event/sttus/devices/{deviceId}";
const CTRL_URL =
  "https://us.api.winix-iot.com/common/control/devices/{deviceId}/{identityId}/{attribute}:{value}";

const ATTR_POWER = "A02";
const ATTR_MODE = "A03";
const ATTR_AIRFLOW = "A04";

const POWER_ON = "1";
const MODE_MANUAL = "02";

function airflowToSpeed(airflow: string | undefined): FanSpeed | null {
  switch (airflow) {
    case "01":
      return "low";
    case "02":
      return "medium";
    case "03":
      return "high";
    case "05":
      return "turbo";
    default:
      return null;
  }
}

function speedToAirflow(speed: FanSpeed): string {
  switch (speed) {
    case "low":
      return "01";
    case "medium":
      return "02";
    case "high":
      return "03";
    case "turbo":
      return "05";
  }
}

function stateUrl(deviceId: string): string {
  return STATE_URL.replace("{deviceId}", encodeURIComponent(deviceId));
}

function controlUrl(deviceId: string, identityId: string, attribute: string, value: string): string {
  return CTRL_URL
    .replace("{deviceId}", encodeURIComponent(deviceId))
    // Winix expects the region separator literally; an encoded colon is rejected.
    .replace("{identityId}", encodeURIComponent(identityId).replace(/%3A/g, ":"))
    .replace("{attribute}", attribute)
    .replace("{value}", value);
}

type DeviceResponse = {
  headers?: { resultCode?: string; resultMessage?: string };
  body?: { data?: Array<{ attributes?: Record<string, string> }> };
};

async function readResponse(response: Response): Promise<DeviceResponse> {
  if (!response.ok) {
    throw new Error(`Winix API error ${response.status}`);
  }
  const payload = await response.json() as DeviceResponse;
  const message = payload?.headers?.resultMessage?.toLowerCase();
  const emptySuccess = message === "" && payload.headers?.resultCode === "S100";
  if (!emptySuccess && message !== "success" && message !== "ok" && message !== "control success") {
    throw new Error(`Winix device API returned ${message ?? "missing result message"}`);
  }
  return payload;
}

export interface WinixDeviceClient {
  getState(deviceId: string): Promise<WinixDeviceState>;
  setPowerOn(deviceId: string): Promise<void>;
  setModeManual(deviceId: string): Promise<void>;
  setAirflow(deviceId: string, speed: FanSpeed): Promise<void>;
}

export function createWinixDeviceClient(identityId: string): WinixDeviceClient {
  if (!identityId.trim()) throw new Error("Winix device client requires an identity ID");
  return {
    async getState(deviceId: string): Promise<WinixDeviceState> {
      const response = await fetch(stateUrl(deviceId));
      const payload = await readResponse(response);

      const attributes = payload.body?.data?.[0]?.attributes;
      if (!attributes) {
        throw new Error("Winix state payload was missing attributes");
      }

      return {
        power: attributes[ATTR_POWER] === POWER_ON ? "on" : "off",
        mode: attributes[ATTR_MODE] === MODE_MANUAL ? "manual" : "auto",
        airflow: airflowToSpeed(attributes[ATTR_AIRFLOW]),
      };
    },
    async setPowerOn(deviceId: string): Promise<void> {
      const response = await fetch(controlUrl(deviceId, identityId, ATTR_POWER, POWER_ON));
      await readResponse(response);
    },
    async setModeManual(deviceId: string): Promise<void> {
      const response = await fetch(controlUrl(deviceId, identityId, ATTR_MODE, MODE_MANUAL));
      await readResponse(response);
    },
    async setAirflow(deviceId: string, speed: FanSpeed): Promise<void> {
      const response = await fetch(
        controlUrl(deviceId, identityId, ATTR_AIRFLOW, speedToAirflow(speed)),
      );
      await readResponse(response);
    },
  };
}
