import { describe, expect, it } from "vitest";
import { buildFilterSearch, parseFilterSearch } from "./filterUrl";

describe("filter URL serialisation", () => {
  it("omits default values", () => {
    expect(
      buildFilterSearch({
        selectedDistrict: null,
        compareDistrict: null,
        tenure: "sale",
        propertyClass: "ALL",
      }),
    ).toBe("");
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

  it("ignores invalid districts and classes", () => {
    expect(parseFilterSearch("?district=Z&class=Q&tenure=lease")).toEqual({});
    expect(buildFilterSearch({ selectedDistrict: "Z", propertyClass: "Q" })).toBe("");
  });
});
