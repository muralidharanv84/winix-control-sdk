# winix-control-sdk

Worker-safe Winix SDK and PM2.5 control utilities.

This package is designed for Cloudflare Workers and other modern runtimes with `fetch`, `crypto.subtle`, and `BigInt` support.

## Disclaimer

This is an unofficial community package and is not affiliated with Winix.

## Install

```bash
npm install winix-control-sdk
```

## Runtime Requirements

- Node.js 20+ (for local scripts/tests)
- Runtime support for `fetch`, `atob`/`btoa`, `crypto.subtle`, and `BigInt`

## Quick Start

```ts
import {
  resolveWinixAuthState,
  resolveWinixSession,
  defaultWinixDeviceClient,
} from "winix-control-sdk";

const nowSec = Math.floor(Date.now() / 1000);
const auth = await resolveWinixAuthState(username, password, cachedAuth, nowSec);
const session = await resolveWinixSession(username, auth);

for (const device of session.devices) {
  const state = await defaultWinixDeviceClient.getState(device.deviceId);
  if (state.power !== "on") await defaultWinixDeviceClient.setPowerOn(device.deviceId);
  if (state.mode !== "manual") await defaultWinixDeviceClient.setModeManual(device.deviceId);
  await defaultWinixDeviceClient.setAirflow(device.deviceId, "medium");
}
```

## Control Utility Example

```ts
import { computeTargetSpeed, isWindowStale } from "winix-control-sdk";

if (!isWindowStale(sampleCount, lastSampleTs, nowTs, 3, 360)) {
  const targetSpeed = computeTargetSpeed(pm25Avg, previousSpeed, previousChangeTs, nowTs, {
    deadbandUgm3: 2,
    minDwellSeconds: 600,
  });
  // apply targetSpeed in your own orchestration code
}
```

## Cloudflare Worker Example

```ts
import { resolveWinixAuthState, resolveWinixSession } from "winix-control-sdk";

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(run(env));
  },
};

async function run(env: Env): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  const auth = await resolveWinixAuthState(env.WINIX_USERNAME, env.WINIX_PASSWORD, null, nowSec);
  const session = await resolveWinixSession(env.WINIX_USERNAME, auth);
  console.log("Winix devices", session.devices.length);
}
```

## Public API

- Types: `FanSpeed`, `WinixPowerState`, `WinixModeState`, `StoredWinixAuthState`, `WinixDeviceSummary`, `WinixDeviceState`, `WinixResolvedSession`, `ControlPolicy`
- Auth: `resolveWinixAuthState`, `defaultWinixAuthProvider`
- Session: `resolveWinixSession`, `defaultWinixAccountProvider`
- Device: `defaultWinixDeviceClient`
- Control: `mapPm25ToSpeed`, `chooseHysteresisSpeed`, `applyDwell`, `isWindowStale`, `computeTargetSpeed`, `DEFAULT_CONTROL_POLICY`
- Constants: `WINIX_REFRESH_MARGIN_SECONDS`

## Development

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
```

## Release

This repo uses [Changesets](https://github.com/changesets/changesets) and GitHub Actions for release automation.

Release publishing is configured for npm Trusted Publishing (OIDC), so no long-lived `NPM_TOKEN` secret is required in GitHub Actions.

One-time npm setup:

1. In npm package settings for `winix-control-sdk`, add a trusted publisher.
2. Provider: GitHub Actions
3. Repository: `muralidharanv84/winix-control-sdk`
4. Workflow file: `.github/workflows/release.yml`
5. Environment: leave empty (unless you explicitly use one)
