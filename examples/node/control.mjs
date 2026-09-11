import { pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";
import {
  createWinixDeviceClient,
  resolveWinixAuthState,
  resolveWinixSession,
} from "winix-control-sdk";

const speeds = new Set(["low", "medium", "high", "turbo"]);
const usage = "Usage: node control.mjs [device-id low|medium|high|turbo]";

export async function run(args, env = process.env) {
  const [deviceId, speed] = args;
  if (args.length !== 0 && (args.length !== 2 || !deviceId || !speeds.has(speed))) {
    throw new Error(usage);
  }
  const username = env.WINIX_USERNAME?.trim();
  const password = env.WINIX_PASSWORD;
  if (!username || !password) throw new Error("Set WINIX_USERNAME and WINIX_PASSWORD");

  // A one-off command logs in once; recurring applications should persist auth.
  const auth = await resolveWinixAuthState(username, password, null, Math.floor(Date.now() / 1000));
  const session = await resolveWinixSession(username, auth);
  const client = createWinixDeviceClient(session.identityId);
  const devices = deviceId
    ? session.devices.filter((device) => device.deviceId === deviceId)
    : session.devices;
  if (deviceId && devices.length === 0) throw new Error("Device ID was not found in this account");

  const results = [];
  for (const device of devices) {
    let state = await client.getState(device.deviceId);
    if (speed) {
      if (state.power !== "on") await client.setPowerOn(device.deviceId);
      if (state.mode !== "manual") await client.setModeManual(device.deviceId);
      if (state.airflow !== speed) await client.setAirflow(device.deviceId, speed);
      state = await client.getState(device.deviceId);
    }
    results.push({ deviceId: device.deviceId, alias: device.alias, ...state });
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  if (process.argv[2] === "--help") {
    console.log(usage);
    console.log("Omit arguments to list purifiers and read their state.");
  } else {
    run(process.argv.slice(2)).then((results) => console.table(results)).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
}
