# winix-control-sdk

## 0.3.0

### Minor Changes

- Restore Winix Smart 1.5.7 support with the public Cognito client, cached ID tokens,
  encrypted mobile handshake, and account identity in device command URLs. Keep the
  SDK free of runtime dependencies using Web Crypto and fetch.

  Replace the obsolete defaultWinixDeviceClient with createWinixDeviceClient(session.identityId).
  Custom account provider handles now expose identityId. Legacy token caches are
  refreshed automatically, and device errors within HTTP 200 responses are rejected.
  Remove retired client-secret hashing and duplicate JWT decoding, and normalize SRP
  modular arithmetic and canonical challenge usernames.

## 0.2.1

### Patch Changes

- f451950: Publish a patch release that includes the latest auth/account documentation updates and release workflow stability fixes.

## 0.2.0

### Minor Changes

- f70bea2: Remove PM2.5 control-policy utilities from the SDK public API.

  The package now focuses on reusable Winix auth/session/device primitives.
  Control thresholds, hysteresis, and dwell logic should live in application code.

## 0.1.0

### Minor Changes

- Initial public release of `winix-control-sdk` with:

  - Worker-safe Winix Cognito SRP auth and refresh flows
  - Winix session/device APIs
  - PM2.5 control utility functions
  - TypeScript types and subpath exports
  - Tests, docs, and CI release automation
