import { describe, expect, it } from "vitest";

import { fmtPct } from "./format";

describe("fmtPct", () => {
  it("does not add a plus sign to exactly zero", () => {
    expect(fmtPct(0)).toBe("0.0%");
  });

  it("keeps explicit signs for positive and negative values", () => {
    expect(fmtPct(1.24)).toBe("+1.2%");
    expect(fmtPct(-1.24)).toBe("-1.2%");
  });
});
