# winix-control-sdk

Winix authentication, account sessions, and purifier control with no runtime dependencies.

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
  createWinixDeviceClient,
} from "winix-control-sdk";

const nowSec = Math.floor(Date.now() / 1000);
const auth = await resolveWinixAuthState(username, password, cachedAuth, nowSec);
const session = await resolveWinixSession(username, auth);
const client = createWinixDeviceClient(session.identityId);

for (const device of session.devices) {
  const state = await client.getState(device.deviceId);
  if (state.power !== "on") await client.setPowerOn(device.deviceId);
  if (state.mode !== "manual") await client.setModeManual(device.deviceId);
  await client.setAirflow(device.deviceId, "medium");
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

- Types: `FanSpeed`, `WinixPowerState`, `WinixModeState`, `StoredWinixAuthState`, `WinixDeviceSummary`, `WinixDeviceState`, `WinixResolvedSession`
- Auth: `resolveWinixAuthState`, `defaultWinixAuthProvider`
- Session: `resolveWinixSession`, `defaultWinixAccountProvider`
- Device: `createWinixDeviceClient(identityId)`
- Constants: `WINIX_REFRESH_MARGIN_SECONDS`

## Upgrading from 0.2.x

Winix retired its previous Cognito client and changed its mobile protocol. Version
0.3 uses the current public client, encrypted mobile requests, and identity-based
device commands. The SDK continues to use Web Crypto and `fetch`; no Node shims,
AWS SDK, Axios, or special Worker bundler aliases are needed.

- Replace `defaultWinixDeviceClient` with `createWinixDeviceClient(session.identityId)`.
- Persist `auth.idToken` alongside the existing tokens. Cached auth without it is
  refreshed automatically; revoked refresh tokens fall back to full login.
- `accessExpiresAt` remains epoch **seconds**.
- Custom `WinixAccountProvider` handles now return `identityId` as well as `getDevices()`.
- Device errors are checked inside HTTP 200 responses, including disconnected
  devices. The live `S100` success response with an empty message is supported.

AQI thresholds, hysteresis, dwell timing, device selection, and persistence belong
in the consuming application.

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
