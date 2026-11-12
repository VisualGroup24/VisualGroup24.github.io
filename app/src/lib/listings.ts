import type { Tenure } from "./filterUrl";
import { median, quantile } from "./stats";

/** One listing-level record from the crawl snapshot. */
export type ListingRecord = {
  district_code: string;
  tenure: Tenure;
  /** Sale $/ft² for sale rows; rent $/ft² for rent rows. */
  price_psf: number;
  area: number;
};

export function listingTotal(listing: ListingRecord): number {
  return listing.area * listing.price_psf;
}

export function selectListings(
  records: ListingRecord[],
  options: { district: string | null; tenure: Tenure },
): ListingRecord[] {
  return records.filter(
    (record) =>
      record.tenure === options.tenure &&
      (!options.district || record.district_code === options.district) &&
      record.area > 0 &&
      record.price_psf > 0,
  );
}

/** Share of listings whose total cost (price or monthly rent) is inside the cap. */
export function reachableShare(
  records: ListingRecord[],
  cap: number,
): { within: number; total: number; share: number } {
  const total = records.length;
  if (!total) return { within: 0, total: 0, share: 0 };
  const within = records.filter(
    (record) => cap > 0 && listingTotal(record) <= cap,
  ).length;
  return { within, total, share: (within / total) * 100 };
}

/**
 * Clip the scatter to the 99th percentile of area and total cost. The raw
 * sample reaches 22,500 ft² and HK$964k/ft², which would otherwise flatten it.
 */
export function clipListings(
  records: ListingRecord[],
  q = 0.99,
): { plotted: ListingRecord[]; clipped: number; areaLimit: number; priceLimit: number } {
  if (!records.length) {
    return { plotted: [], clipped: 0, areaLimit: 0, priceLimit: 0 };
  }
  const areaLimit = quantile(records.map((record) => record.area), q);
  const priceLimit = quantile(records.map((record) => listingTotal(record)), q);
  const plotted = records.filter(
    (record) => record.area <= areaLimit && listingTotal(record) <= priceLimit,
  );
  return { plotted, clipped: records.length - plotted.length, areaLimit, priceLimit };
}

export type RentDistribution = {
  n: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
};

/** Rent $/ft² distribution for a district's current rental listings. */
export function rentDistribution(
  records: ListingRecord[],
  district: string | null,
): RentDistribution | null {
  const values = records
    .filter(
      (record) =>
        record.tenure === "rent" &&
        (!district || record.district_code === district) &&
        record.price_psf > 0,
    )
    .map((record) => record.price_psf);
  if (values.length < 3) return null;
  return {
    n: values.length,
    p10: quantile(values, 0.1),
    p25: quantile(values, 0.25),
    median: median(values),
    p75: quantile(values, 0.75),
    p90: quantile(values, 0.9),
  };
}
