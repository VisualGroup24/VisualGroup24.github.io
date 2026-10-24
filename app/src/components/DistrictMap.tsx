import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DistrictCollection } from "../data/types";
import { divergingColor, divergingLegend } from "../lib/colorScale";

type MetricFormat = (value: number | null) => string;

type Props = {
  geojson: DistrictCollection;
  values: Record<string, number | null>;
  selected: string | null;
  onSelect: (code: string) => void;
  diverging?: boolean;
  formatValue?: MetricFormat;
  metricLabel?: string;
  height?: number;
};

function scale(values: Record<string, number | null>, diverging: boolean) {
  const numeric = Object.values(values).filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );

  if (diverging) {
    if (!numeric.length) {
      return {
        min: 0,
        max: 0,
        colorFor: () => "#d6d3d1",
        gradient: "#d6d3d1",
        zeroPct: 50,
      };
    }
    const min = Math.min(0, ...numeric);
    const max = Math.max(0, ...numeric);
    const { gradient, zeroPct } = divergingLegend(min, max);
    return {
      min,
      max,
      colorFor: (value: number | null | undefined) =>
        value === null || value === undefined || Number.isNaN(value)
          ? "#d6d3d1"
          : divergingColor(value, min, max),
      gradient,
      zeroPct,
    };
  }

  const min = numeric.length ? Math.min(...numeric) : 0;
  const max = numeric.length ? Math.max(...numeric) : 1;
  const palette = ["#f0fdfa", "#99f6e4", "#2dd4bf", "#0f766e", "#134e4a"];

  // Quantile breaks spread the 18 districts across the palette instead of
  // letting one expensive outlier flatten the rest of the map.
  const sorted = [...numeric].sort((a, b) => a - b);
  const breaks = [0.2, 0.4, 0.6, 0.8].map(
    (q) => sorted[Math.floor((sorted.length - 1) * q)],
  );
  const colorFor = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) return "#d6d3d1";
    const index = breaks.filter((edge) => value > edge).length;
    return palette[Math.min(index, palette.length - 1)];
  };
  return {
    min,
    max,
    colorFor,
    gradient: `linear-gradient(90deg, ${palette.join(",")})`,
    zeroPct: 50,
  };
}

export default function DistrictMap({
  geojson,
  values,
  selected,
  onSelect,
  diverging = false,
  formatValue = (value) => (value === null ? "—" : String(value)),
  metricLabel = "Value",
  height = 420,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.GeoJSON | null>(null);
  const valuesRef = useRef(values);
  const selectedRef = useRef(selected);
  const divergingRef = useRef(diverging);
  const onSelectRef = useRef(onSelect);
  const formatRef = useRef(formatValue);
  const labelRef = useRef(metricLabel);
  valuesRef.current = values;
  selectedRef.current = selected;
  divergingRef.current = diverging;
  onSelectRef.current = onSelect;
  formatRef.current = formatValue;
  labelRef.current = metricLabel;

  const { min, max, colorFor, gradient, zeroPct } = useMemo(
    () => scale(values, diverging),
    [values, diverging],
  );

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = L.map(container.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
      minZoom: 9,
      maxZoom: 15,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      className: "hka-basemap",
      opacity: 0.7,
      maxZoom: 19,
    }).addTo(instance);

    const geoLayer = L.geoJSON(geojson as unknown as GeoJSON.GeoJsonObject, {
      style: (feature) => {
        const code = feature?.properties?.district_code as string | undefined;
        const value = code ? valuesRef.current[code] : null;
        return {
          fillColor: colorFor(value),
          fillOpacity: 0.8,
          color:
            code === selectedRef.current
              ? "#0f172a"
              : divergingRef.current
                ? "#cbd5e1"
                : "#ffffff",
          weight: code === selectedRef.current ? 3 : 1,
        };
      },
      onEachFeature: (feature, featureLayer) => {
        const code = feature.properties?.district_code as string;
        const path = featureLayer as L.Path;
        path.on({
          click: () => onSelectRef.current(code),
          mouseover: () => {
            path.setStyle({ weight: 2.5, color: "#334155" });
            path.bringToFront();
          },
          mouseout: () => {
            path.setStyle({
              weight: code === selectedRef.current ? 3 : 1,
              color:
                code === selectedRef.current
                  ? "#0f172a"
                  : divergingRef.current
                    ? "#cbd5e1"
                    : "#ffffff",
            });
          },
        });
      },
    }).addTo(instance);

    layer.current = geoLayer;
    const bounds = geoLayer.getBounds();
    if (bounds.isValid()) instance.fitBounds(bounds, { padding: [10, 10], maxZoom: 10 });
    map.current = instance;

    return () => {
      instance.remove();
      map.current = null;
      layer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geojson]);

  useEffect(() => {
    const geoLayer = layer.current;
    if (!geoLayer) return;
    geoLayer.setStyle((feature) => {
      const code = feature?.properties?.district_code as string | undefined;
      const value = code ? values[code] : null;
      return {
        fillColor: colorFor(value),
        fillOpacity: 0.8,
        color: code === selected ? "#0f172a" : diverging ? "#cbd5e1" : "#ffffff",
        weight: code === selected ? 3 : 1,
      };
    });
    geoLayer.eachLayer((featureLayer) => {
      const feature = (featureLayer as L.Path & { feature?: GeoJSON.Feature }).feature;
      if (!feature) return;
      const code = feature.properties?.district_code as string;
      const name = feature.properties?.name_en as string;
      const value = values[code];
      (featureLayer as L.Path).bindTooltip(
        `<div style="font-family:Inter,sans-serif;font-size:12px"><strong>${name}</strong><br/>${metricLabel}: ${formatValue(value ?? null)}</div>`,
        { sticky: true, direction: "top", className: "hka-map-tooltip", opacity: 1 },
      );
    });
  }, [values, selected, colorFor, diverging, formatValue, metricLabel]);

  return (
    <div className="relative">
      <div
        ref={container}
        className="w-full overflow-hidden rounded-xl border border-[var(--border)]"
        style={{ height }}
        role="img"
        aria-label="Choropleth map of Hong Kong's 18 districts"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
        <div className="flex items-center gap-1.5">
          <span className="tabular-nums">{formatValue(min)}</span>
          <div className="relative w-32">
            <span className="block h-2 w-full rounded-full" style={{ background: gradient }} />
            {diverging && min < 0 && max > 0 ? (
              <>
                <span
                  className="absolute -top-0.5 h-3 w-px -translate-x-1/2 bg-slate-500/70"
                  style={{ left: `${zeroPct}%` }}
                />
                {zeroPct > 8 && zeroPct < 92 ? (
                  <span
                    className="absolute -bottom-3.5 -translate-x-1/2 text-[9px] leading-none tabular-nums text-[var(--text-muted)]"
                    style={{ left: `${zeroPct}%` }}
                  >
                    {formatValue(0)}
                  </span>
                ) : null}
              </>
            ) : null}
          </div>
          <span className="tabular-nums">{formatValue(max)}</span>
        </div>
        <span>Click a district to filter · grey = insufficient data</span>
      </div>
    </div>
  );
}
