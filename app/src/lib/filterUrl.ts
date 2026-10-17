export type FilterSnapshot = {
  tenure: "sale" | "rent";
  selectedDistrict: string | null;
  compareDistrict: string | null;
  propertyClass: string;
};

const DISTRICT_CODES = new Set("ABCDEFGHJKLMNPQRST".split(""));
const CLASSES = new Set(["ALL", "A", "B", "C", "D", "E"]);

/** Serialise the global filters to a stable query string (including the "?"). */
export function buildFilterSearch(filters: Partial<FilterSnapshot>): string {
  const params = new URLSearchParams();
  if (filters.selectedDistrict && DISTRICT_CODES.has(filters.selectedDistrict)) {
    params.set("district", filters.selectedDistrict);
  }
  if (filters.tenure === "rent") params.set("tenure", "rent");
  if (filters.propertyClass && filters.propertyClass !== "ALL" && CLASSES.has(filters.propertyClass)) {
    params.set("class", filters.propertyClass);
  }
  if (filters.compareDistrict && DISTRICT_CODES.has(filters.compareDistrict)) {
    params.set("compare", filters.compareDistrict);
  }
  const value = params.toString();
  return value ? `?${value}` : "";
}

/** Read global filters from a query string, ignoring invalid values. */
export function parseFilterSearch(search: string): Partial<FilterSnapshot> {
  const params = new URLSearchParams(search);
  const result: Partial<FilterSnapshot> = {};
  const district = params.get("district");
  if (district && DISTRICT_CODES.has(district)) result.selectedDistrict = district;
  const compare = params.get("compare");
  if (compare && DISTRICT_CODES.has(compare)) result.compareDistrict = compare;
  const tenure = params.get("tenure");
  if (tenure === "sale" || tenure === "rent") result.tenure = tenure;
  const propertyClass = params.get("class");
  if (propertyClass && CLASSES.has(propertyClass)) result.propertyClass = propertyClass;
  return result;
}
