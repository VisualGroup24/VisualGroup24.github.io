import { useEffect, useState } from "react";
import type { ListingRecord } from "../lib/listings";

type RawListing = {
  district_code: string;
  price_psf: number;
  area: number;
  rent: boolean;
};

type RawPayload = { scores: RawListing[] };

let promise: Promise<ListingRecord[]> | null = null;

/**
 * The pipeline's listing-level snapshot. It carries area, $/ft², district and
 * tenure for 13,431 complete listings and is the only listing-level source in
 * the shipped data; the app uses it as plain listing records.
 */
export function loadListings(): Promise<ListingRecord[]> {
  if (!promise) {
    promise = fetch(`${import.meta.env.BASE_URL}data/latest/pca.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load the listing sample (${response.status})`);
        return response.json() as Promise<RawPayload>;
      })
      .then((payload) =>
        (payload.scores ?? [])
          .filter((row) => row.area > 0 && row.price_psf > 0)
          .map((row) => ({
            district_code: row.district_code,
            tenure: row.rent ? ("rent" as const) : ("sale" as const),
            price_psf: row.price_psf,
            area: row.area,
          })),
      );
  }
  return promise;
}

export function useListings() {
  const [data, setData] = useState<ListingRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadListings()
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, error };
}
