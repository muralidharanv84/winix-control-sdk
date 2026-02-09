import { describe, expect, it } from "vitest";
import {
  applyDwell,
  chooseHysteresisSpeed,
  computeTargetSpeed,
  isWindowStale,
  mapPm25ToSpeed,
} from "../src/control";

describe("control utilities", () => {
  it("maps PM2.5 boundaries to expected fan speeds", () => {
    expect(mapPm25ToSpeed(9.9)).toBe("low");
    expect(mapPm25ToSpeed(10.0)).toBe("medium");
    expect(mapPm25ToSpeed(19.9)).toBe("medium");
    expect(mapPm25ToSpeed(20.0)).toBe("high");
    expect(mapPm25ToSpeed(30.0)).toBe("high");
    expect(mapPm25ToSpeed(30.1)).toBe("turbo");
  });

  it("applies hysteresis deadband around thresholds", () => {
    expect(chooseHysteresisSpeed(22, "medium", 2)).toBe("high");
    expect(chooseHysteresisSpeed(21.9, "medium", 2)).toBe("medium");
    expect(chooseHysteresisSpeed(17.9, "high", 2)).toBe("medium");
    expect(chooseHysteresisSpeed(28, "turbo", 2)).toBe("high");
    expect(chooseHysteresisSpeed(7.9, "medium", 2)).toBe("low");
  });

  it("enforces dwell time to avoid rapid fan flips", () => {
    expect(applyDwell("high", "medium", 1000, 1599, 600)).toBe("medium");
    expect(applyDwell("high", "medium", 1000, 1600, 600)).toBe("high");
  });

  it("flags stale PM2.5 windows correctly", () => {
    expect(isWindowStale(2, 1000, 1100, 3, 360)).toBe(true);
    expect(isWindowStale(3, null, 1100, 3, 360)).toBe(true);
    expect(isWindowStale(3, 600, 1100, 3, 360)).toBe(true);
    expect(isWindowStale(3, 900, 1100, 3, 360)).toBe(false);
  });

  it("computes target speed using hysteresis and dwell together", () => {
    expect(
      computeTargetSpeed(28, "medium", 1000, 1300, {
        deadbandUgm3: 2,
        minDwellSeconds: 600,
      }),
    ).toBe("medium");

    expect(
      computeTargetSpeed(28, "medium", 1000, 1700, {
        deadbandUgm3: 2,
        minDwellSeconds: 600,
      }),
    ).toBe("high");
  });
});
