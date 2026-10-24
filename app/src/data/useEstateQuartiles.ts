import { useEffect, useState } from "react";

export type EstateQuartile = {
  n: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  period: [string, string];
};

export type EstateQuartiles = Record<string, EstateQuartile>;

let promise: Promise<EstateQuartiles> | null = null;

export function useEstateQuartiles() {
  const [data, setData] = useState<EstateQuartiles | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!promise) {
      promise = fetch(`${import.meta.env.BASE_URL}data/latest/estate-quartiles.json`).then(
        (response) => {
          if (!response.ok) {
            throw new Error(`Could not load estate distributions (${response.status})`);
          }
          return response.json() as Promise<EstateQuartiles>;
        },
      );
    }
    promise
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
