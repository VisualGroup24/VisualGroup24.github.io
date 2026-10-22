import { describe, expect, it } from "vitest";

import { divergingColor, divergingLegend } from "./colorScale";

function channels(hex: string): { red: number; green: number; blue: number } {
  return {
    red: parseInt(hex.slice(1, 3), 16),
    green: parseInt(hex.slice(3, 5), 16),
    blue: parseInt(hex.slice(5, 7), 16),
  };
}

describe("divergingColor", () => {
  it("returns white at exactly zero", () => {
    expect(divergingColor(0, -10, 20)).toBe("#ffffff");
  });

  it("uses red for the negative extreme and green for the positive extreme", () => {
    expect(divergingColor(-10, -10, 20)).toBe("#9f1239");
    expect(divergingColor(20, -10, 20)).toBe("#065f46");
  });

  it("keeps the red/green sides on their own side of zero", () => {
    const negative = channels(divergingColor(-5, -10, 20));
    const positive = channels(divergingColor(10, -10, 20));

    expect(negative.red).toBeGreaterThan(negative.green);
    expect(negative.red).toBeGreaterThan(negative.blue);
    expect(positive.green).toBeGreaterThan(positive.red);
    expect(positive.green).toBeGreaterThan(positive.blue);
  });

  it("handles an all-positive or all-negative domain", () => {
    expect(divergingColor(0, 0, 20)).toBe("#ffffff");
    expect(divergingColor(-5, -10, 0)).not.toBe("#ffffff");
    expect(divergingColor(0, -10, 0)).toBe("#ffffff");
  });
});

describe("divergingLegend", () => {
  it("places zero at its true position in an asymmetric domain", () => {
    expect(divergingLegend(-10, 20).zeroPct).toBeCloseTo((10 / 30) * 100, 5);
    expect(divergingLegend(0, 20).zeroPct).toBe(0);
    expect(divergingLegend(-10, 0).zeroPct).toBe(100);
  });

  it("builds a gradient from the same colour scale", () => {
    const { gradient } = divergingLegend(-10, 20);
    expect(gradient.startsWith("linear-gradient(90deg,")).toBe(true);
    expect(gradient).toContain("#9f1239");
    expect(gradient).toContain("#065f46");
    expect(gradient).toContain("#ffffff");
  });

  it("falls back to white when there is no data", () => {
    expect(divergingLegend(0, 0).gradient).toBe("#ffffff");
  });
});
