import { useEffect, useState } from "react";
import type { DistrictData } from "./types";

let districtPromise: Promise<DistrictData> | null = null;

export function loadDistrictData(): Promise<DistrictData> {
  if (!districtPromise) {
    districtPromise = fetch(`${import.meta.env.BASE_URL}data/latest/districts.json`).then(
      (response) => {
        if (!response.ok) throw new Error(`Could not load district data (${response.status})`);
        return response.json() as Promise<DistrictData>;
      },
    );
  }
  return districtPromise;
}

export function useDistrictData() {
  const [data, setData] = useState<DistrictData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadDistrictData()
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, error, loading };
}
