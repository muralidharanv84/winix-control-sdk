import {
  createWinixDeviceClient,
  resolveWinixAuthState,
  resolveWinixSession,
} from "winix-control-sdk";

const speeds = new Set(["low", "medium", "high", "turbo"]);
// Reused only while this Lambda execution environment stays warm.
let cachedAuth = null;

export async function handler(event = {}) {
  const speed = event?.speed;
  if (speed !== undefined && !speeds.has(speed)) {
    throw new Error("speed must be low, medium, high, or turbo");
  }
  const username = process.env.WINIX_USERNAME?.trim();
  const password = process.env.WINIX_PASSWORD;
  const deviceId = process.env.WINIX_DEVICE_ID?.trim();
  if (!username || !password || !deviceId) {
    throw new Error("Set WINIX_USERNAME, WINIX_PASSWORD, and WINIX_DEVICE_ID");
  }

  let session;
  try {
    const auth = await resolveWinixAuthState(username, password, cachedAuth, Math.floor(Date.now() / 1000));
    session = await resolveWinixSession(username, auth);
    cachedAuth = session.auth;
  } catch (error) {
    // Retry with a full login on the next invocation if the account session failed.
    cachedAuth = null;
    throw error;
  }
  const device = session.devices.find((item) => item.deviceId === deviceId);
  if (!device) throw new Error("WINIX_DEVICE_ID was not found in this account");

  const client = createWinixDeviceClient(session.identityId);
  let state = await client.getState(deviceId);
  if (speed !== undefined) {
    if (state.power !== "on") await client.setPowerOn(deviceId);
    if (state.mode !== "manual") await client.setModeManual(deviceId);
    if (state.airflow !== speed) await client.setAirflow(deviceId, speed);
    state = await client.getState(deviceId);
  }
  return { deviceId, alias: device.alias, ...state };
}
