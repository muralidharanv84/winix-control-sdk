# Control Policy

Default policy (`DEFAULT_CONTROL_POLICY`):

- `deadbandUgm3`: `2`
- `minDwellSeconds`: `600`
- `minSamples`: `3`
- `maxAgeSeconds`: `360`

Helpers:

- `mapPm25ToSpeed`: base threshold map
- `chooseHysteresisSpeed`: deadband around thresholds
- `applyDwell`: minimum hold duration
- `isWindowStale`: stale window gate
- `computeTargetSpeed`: convenience composition
