---
"winix-control-sdk": minor
---

Remove PM2.5 control-policy utilities from the SDK public API.

The package now focuses on reusable Winix auth/session/device primitives.
Control thresholds, hysteresis, and dwell logic should live in application code.
