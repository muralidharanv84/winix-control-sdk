import type { FanSpeed } from "./types.js";

export interface ControlPolicy {
  deadbandUgm3: number;
  minDwellSeconds: number;
  minSamples: number;
  maxAgeSeconds: number;
}

export const DEFAULT_CONTROL_POLICY: ControlPolicy = {
  deadbandUgm3: 2,
  minDwellSeconds: 10 * 60,
  minSamples: 3,
  maxAgeSeconds: 360,
};

export function mapPm25ToSpeed(pm25Avg: number): FanSpeed {
  if (pm25Avg < 10) return "low";
  if (pm25Avg < 20) return "medium";
  if (pm25Avg <= 30) return "high";
  return "turbo";
}

export function chooseHysteresisSpeed(
  pm25Avg: number,
  previousSpeed: FanSpeed | null,
  deadbandUgm3: number,
): FanSpeed {
  if (!previousSpeed) return mapPm25ToSpeed(pm25Avg);

  const upToMedium = 10 + deadbandUgm3;
  const upToHigh = 20 + deadbandUgm3;
  const upToTurbo = 30 + deadbandUgm3;

  const downToLow = 10 - deadbandUgm3;
  const downToMedium = 20 - deadbandUgm3;
  const downFromTurbo = 30 - deadbandUgm3;

  switch (previousSpeed) {
    case "low":
      if (pm25Avg < upToMedium) return "low";
      if (pm25Avg < upToHigh) return "medium";
      if (pm25Avg <= upToTurbo) return "high";
      return "turbo";
    case "medium":
      if (pm25Avg < downToLow) return "low";
      if (pm25Avg < upToHigh) return "medium";
      if (pm25Avg <= upToTurbo) return "high";
      return "turbo";
    case "high":
      if (pm25Avg < downToLow) return "low";
      if (pm25Avg < downToMedium) return "medium";
      if (pm25Avg <= upToTurbo) return "high";
      return "turbo";
    case "turbo":
      if (pm25Avg < downToLow) return "low";
      if (pm25Avg < downToMedium) return "medium";
      if (pm25Avg <= downFromTurbo) return "high";
      return "turbo";
  }
}

export function applyDwell(
  targetSpeed: FanSpeed,
  previousSpeed: FanSpeed | null,
  previousChangeTs: number | null,
  nowTs: number,
  minDwellSeconds: number,
): FanSpeed {
  if (!previousSpeed || previousChangeTs === null) return targetSpeed;
  if (targetSpeed === previousSpeed) return previousSpeed;

  const elapsed = nowTs - previousChangeTs;
  if (elapsed < minDwellSeconds) return previousSpeed;
  return targetSpeed;
}

export function isWindowStale(
  sampleCount: number,
  lastSampleTs: number | null,
  nowTs: number,
  minSamples: number,
  maxAgeSeconds: number,
): boolean {
  if (sampleCount < minSamples) return true;
  if (lastSampleTs === null) return true;
  if (nowTs - lastSampleTs > maxAgeSeconds) return true;
  return false;
}

export function computeTargetSpeed(
  pm25Avg: number,
  previousSpeed: FanSpeed | null,
  previousChangeTs: number | null,
  nowTs: number,
  policy: Pick<ControlPolicy, "deadbandUgm3" | "minDwellSeconds"> = DEFAULT_CONTROL_POLICY,
): FanSpeed {
  const targetByHysteresis = chooseHysteresisSpeed(
    pm25Avg,
    previousSpeed,
    policy.deadbandUgm3,
  );
  return applyDwell(
    targetByHysteresis,
    previousSpeed,
    previousChangeTs,
    nowTs,
    policy.minDwellSeconds,
  );
}
