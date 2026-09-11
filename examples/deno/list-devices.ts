import {
  createWinixDeviceClient,
  resolveWinixAuthState,
  resolveWinixSession,
} from "npm:winix-control-sdk@0.3.0";

const username = Deno.env.get("WINIX_USERNAME")?.trim();
const password = Deno.env.get("WINIX_PASSWORD");
if (!username || !password) throw new Error("Set WINIX_USERNAME and WINIX_PASSWORD");

const auth = await resolveWinixAuthState(username, password, null, Math.floor(Date.now() / 1000));
const session = await resolveWinixSession(username, auth);
const client = createWinixDeviceClient(session.identityId);

const devices = [];
for (const device of session.devices) {
  devices.push({
    deviceId: device.deviceId,
    alias: device.alias,
    model: device.model,
    ...await client.getState(device.deviceId),
  });
}
console.table(devices);
