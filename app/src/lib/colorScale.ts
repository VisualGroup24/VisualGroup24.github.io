/** Diverging colour scale for signed metrics, centred on exactly zero. */

// Matches the theme's rose/emerald semantic pair (KPI deltas) with deeper
// 600/800 stops so the fills stay red and green over the light basemap.
const NEGATIVE_RAMP = ["#ffffff", "#fecdd3", "#e11d48", "#9f1239"];
const POSITIVE_RAMP = ["#ffffff", "#a7f3d0", "#059669", "#065f46"];

function channel(hex: string, offset: number): number {
  return parseInt(hex.slice(offset, offset + 2), 16);
}

function mixHex(from: string, to: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const mix = (a: number, b: number) => Math.round(a + (b - a) * clamped);
  return `#${[
    mix(channel(from, 1), channel(to, 1)),
    mix(channel(from, 3), channel(to, 3)),
    mix(channel(from, 5), channel(to, 5)),
  ]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function sampleRamp(ramp: string[], t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const position = clamped * (ramp.length - 1);
  const index = Math.min(ramp.length - 2, Math.floor(position));
  return mixHex(ramp[index], ramp[index + 1], position - index);
}

/** White at exactly 0, red for negatives, green for positives.
 *
 * Intensity follows a square root so small non-zero changes stay visible when
 * a single district dominates the range (common with year-on-year changes).
 */
export function divergingColor(value: number, min: number, max: number): string {
  if (value === 0) return "#ffffff";
  if (value < 0) {
    if (min >= 0) return "#ffffff";
    return sampleRamp(NEGATIVE_RAMP, Math.sqrt(value / min));
  }
  if (max <= 0) return "#ffffff";
  return sampleRamp(POSITIVE_RAMP, Math.sqrt(value / max));
}

/** CSS gradient that matches divergingColor, with the zero position in percent. */
export function divergingLegend(
  min: number,
  max: number,
  steps = 14,
): { gradient: string; zeroPct: number } {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  if (lo === 0 && hi === 0) return { gradient: "#ffffff", zeroPct: 50 };

  const zeroPct = ((0 - lo) / (hi - lo)) * 100;
  const stops: string[] = [];
  if (lo < 0) {
    for (let index = 0; index <= steps; index += 1) {
      const value = lo + ((0 - lo) * index) / steps;
      const percent = (index / steps) * zeroPct;
      stops.push(`${divergingColor(value, lo, hi)} ${percent.toFixed(2)}%`);
    }
  }
  if (hi > 0) {
    for (let index = 0; index <= steps; index += 1) {
      const value = (hi * index) / steps;
      const percent = zeroPct + (index / steps) * (100 - zeroPct);
      stops.push(`${divergingColor(value, lo, hi)} ${percent.toFixed(2)}%`);
    }
  }
  return { gradient: `linear-gradient(90deg, ${stops.join(", ")})`, zeroPct };
}
