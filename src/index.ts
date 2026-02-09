export { resolveWinixAuthState, defaultWinixAuthProvider } from "./auth.js";
export { resolveWinixSession, defaultWinixAccountProvider } from "./account.js";
export { defaultWinixDeviceClient } from "./device.js";
export {
  DEFAULT_CONTROL_POLICY,
  mapPm25ToSpeed,
  chooseHysteresisSpeed,
  applyDwell,
  isWindowStale,
  computeTargetSpeed,
} from "./control.js";
export { WINIX_REFRESH_MARGIN_SECONDS } from "./constants.js";

export type { WinixAuthProvider } from "./auth.js";
export type { WinixAccountHandle, WinixAccountProvider } from "./account.js";
export type { WinixDeviceClient } from "./device.js";
export type { ControlPolicy } from "./control.js";
export type {
  FanSpeed,
  WinixPowerState,
  WinixModeState,
  StoredWinixAuthState,
  WinixDeviceSummary,
  WinixDeviceState,
  WinixResolvedSession,
} from "./types.js";
