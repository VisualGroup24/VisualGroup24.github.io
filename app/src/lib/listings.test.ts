import { describe, expect, it } from "vitest";
import {
  clipListings,
  listingTotal,
  reachableShare,
  rentDistribution,
  selectListings,
  type ListingRecord,
} from "./listings";

const RECORDS: ListingRecord[] = [
  { district_code: "A", tenure: "sale", price_psf: 10_000, area: 500 },
  { district_code: "A", tenure: "sale", price_psf: 20_000, area: 500 },
  { district_code: "B", tenure: "sale", price_psf: 15_000, area: 400 },
  { district_code: "A", tenure: "rent", price_psf: 30, area: 500 },
  { district_code: "A", tenure: "rent", price_psf: 40, area: 500 },
  { district_code: "A", tenure: "rent", price_psf: 50, area: 500 },
  { district_code: "A", tenure: "rent", price_psf: 60, area: 500 },
];

describe("listing sample helpers", () => {
  it("selects by tenure and district", () => {
    expect(selectListings(RECORDS, { district: "A", tenure: "sale" })).toHaveLength(2);
    expect(selectListings(RECORDS, { district: null, tenure: "rent" })).toHaveLength(4);
    expect(selectListings(RECORDS, { district: "B", tenure: "rent" })).toHaveLength(0);
  });

  it("prices a listing as area × $/ft²", () => {
    expect(listingTotal(RECORDS[0])).toBe(5_000_000);
    expect(listingTotal(RECORDS[3])).toBe(15_000);
  });

  it("counts reachable listings against the cap", () => {
    const rent = selectListings(RECORDS, { district: "A", tenure: "rent" });
    expect(reachableShare(rent, 16_000)).toEqual({ within: 1, total: 4, share: 25 });
    expect(reachableShare([], 16_000)).toEqual({ within: 0, total: 0, share: 0 });
  });

  it("clips the 99th percentile outliers", () => {
    const withOutlier: ListingRecord[] = [
      ...Array.from({ length: 20 }, (_, index) => ({
        district_code: "A",
        tenure: "sale" as const,
        price_psf: 10_000 + index * 100,
        area: 400 + index * 10,
      })),
      { district_code: "A", tenure: "sale", price_psf: 964_126, area: 22_500 },
    ];
    const result = clipListings(withOutlier);
    expect(result.clipped).toBeGreaterThanOrEqual(1);
    expect(result.plotted.every((record) => record.area <= result.areaLimit)).toBe(true);
  });

  it("builds a rent distribution for a district", () => {
    const distribution = rentDistribution(RECORDS, "A");
    expect(distribution).not.toBeNull();
    expect(distribution?.n).toBe(4);
    expect(distribution?.median).toBe(45);
    expect(rentDistribution(RECORDS, "B")).toBeNull();
  });
});
