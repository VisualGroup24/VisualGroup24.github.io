import { useEffect, useState } from "react";
import type { DistrictCollection, MarketData } from "./types";

let marketPromise: Promise<MarketData> | null = null;
let districtsPromise: Promise<DistrictCollection> | null = null;

function dataUrl(file: string): string {
  return `${import.meta.env.BASE_URL}data/latest/${file}`;
}

export function loadMarket(): Promise<MarketData> {
  if (!marketPromise) {
    marketPromise = fetch(dataUrl("market.json")).then((response) => {
      if (!response.ok) throw new Error(`Could not load market data (${response.status})`);
      return response.json() as Promise<MarketData>;
    });
  }
  return marketPromise;
}

export function loadDistricts(): Promise<DistrictCollection> {
  if (!districtsPromise) {
    districtsPromise = fetch(dataUrl("districts.geojson")).then((response) => {
      if (!response.ok) throw new Error(`Could not load district boundaries (${response.status})`);
      return response.json() as Promise<DistrictCollection>;
    });
  }
  return districtsPromise;
}

export function useMarket() {
  const [data, setData] = useState<MarketData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadMarket()
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

export function useDistricts() {
  const [data, setData] = useState<DistrictCollection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadDistricts()
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
