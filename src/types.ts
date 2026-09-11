export type FanSpeed = "low" | "medium" | "high" | "turbo";

export type WinixPowerState = "on" | "off";
export type WinixModeState = "auto" | "manual";

export interface StoredWinixAuthState {
  userId: string;
  accessToken: string;
  // Optional only for caches written by older SDK releases; refreshed before use.
  idToken?: string | null;
  refreshToken: string;
  accessExpiresAt: number; // epoch seconds
}

export interface WinixDeviceSummary {
  deviceId: string;
  alias: string | null;
  model: string | null;
}

export interface WinixDeviceState {
  power: WinixPowerState;
  mode: WinixModeState;
  airflow: FanSpeed | null;
}

export interface WinixResolvedSession {
  auth: StoredWinixAuthState;
  identityId: string;
  devices: WinixDeviceSummary[];
}
