import { describe, expect, it } from "vitest";
import { buildFilterSearch, parseFilterSearch } from "./filterUrl";

describe("filter URL serialisation", () => {
  it("omits default values", () => {
    expect(
      buildFilterSearch({
        selectedDistrict: null,
        compareDistrict: null,
        tenure: null,
        propertyClass: "ALL",
        monthlyIncome: 45_000,
        depositPct: 30,
        mortgageRate: 4.2,
        flatSize: 500,
        loanYears: 30,
        dsrCap: 50,
        rtiCap: 40,
      }),
    ).toBe("");
  });

  it("encodes the rent-buy gate", () => {
    expect(buildFilterSearch({ tenure: null })).toBe("");
    expect(buildFilterSearch({ tenure: "sale" })).toBe("?tenure=buy");
    expect(buildFilterSearch({ tenure: "rent" })).toBe("?tenure=rent");
    expect(parseFilterSearch("?tenure=buy")).toEqual({ tenure: "sale" });
    expect(parseFilterSearch("?tenure=sale")).toEqual({ tenure: "sale" });
    expect(parseFilterSearch("?tenure=rent")).toEqual({ tenure: "rent" });
    expect(parseFilterSearch("?tenure=lease")).toEqual({});
  });

  it("round-trips global filters", () => {
    const search = buildFilterSearch({
      selectedDistrict: "M",
      compareDistrict: "A",
      tenure: "rent",
      propertyClass: "C",
    });
    expect(search).toContain("district=M");
    expect(search).toContain("compare=A");
    expect(search).toContain("tenure=rent");
    expect(search).toContain("class=C");
    expect(parseFilterSearch(search)).toEqual({
      selectedDistrict: "M",
      compareDistrict: "A",
      tenure: "rent",
      propertyClass: "C",
    });
  });

  it("round-trips the numeric brief", () => {
    const search = buildFilterSearch({
      monthlyIncome: 60_000,
      depositPct: 40,
      mortgageRate: 3.75,
      flatSize: 650,
      loanYears: 25,
      dsrCap: 40,
      rtiCap: 35,
    });
    expect(parseFilterSearch(search)).toEqual({
      monthlyIncome: 60_000,
      depositPct: 40,
      mortgageRate: 3.75,
      flatSize: 650,
      loanYears: 25,
      dsrCap: 40,
      rtiCap: 35,
    });
  });

  it("ignores invalid districts and classes", () => {
    expect(parseFilterSearch("?district=Z&class=Q&tenure=lease")).toEqual({});
    expect(buildFilterSearch({ selectedDistrict: "Z", propertyClass: "Q" })).toBe("");
  });

  it("clamps out-of-range numbers and drops non-numeric values", () => {
    expect(parseFilterSearch("?deposit=150&dsr=10&size=abc&rate=-4&income=2e9")).toEqual({
      depositPct: 95,
      dsrCap: 30,
      mortgageRate: 0,
      monthlyIncome: 1_000_000,
    });
    expect(parseFilterSearch("?deposit=&income=")).toEqual({});
  });
});
