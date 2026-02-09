# winix-control-sdk

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
