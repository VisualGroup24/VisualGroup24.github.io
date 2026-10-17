import { useEffect, useState } from "react";

export type PcaLoading = {
  feature: string;
  label: string;
  pc1: number;
  pc2: number;
  pc3: number;
  pc4: number;
};

export type PcaScore = {
  pc1: number;
  pc2: number;
  district_code: string;
  tenure: "sale" | "rent";
  price_psf: number;
  area: number;
  rent: boolean;
};

export type PcaData = {
  n: number;
  features: string[];
  explained: number[];
  loadings: PcaLoading[];
  scores: PcaScore[];
};

let promise: Promise<PcaData> | null = null;

export function usePca() {
  const [data, setData] = useState<PcaData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!promise) {
      promise = fetch(`${import.meta.env.BASE_URL}data/latest/pca.json`).then((response) => {
        if (!response.ok) throw new Error(`Could not load PCA data (${response.status})`);
        return response.json() as Promise<PcaData>;
      });
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
