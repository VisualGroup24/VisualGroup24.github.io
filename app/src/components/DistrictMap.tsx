import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DistrictCollection } from "../data/types";
import { divergingColor, divergingLegend } from "../lib/colorScale";
import { useTheme } from "../state/theme";

type MetricFormat = (value: number | null) => string;

type Props = {
  geojson: DistrictCollection;
  values: Record<string, number | null>;
  selected: string | null;
  onSelect: (code: string) => void;
  diverging?: boolean;
  formatValue?: MetricFormat;
  metricLabel?: string;
  /** "100%" fills a panel body; a number renders a fixed map block. */
  height?: number | string;
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
  height = "100%",
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
  const dark = useTheme((state) => state.mode === "dark");
  const darkRef = useRef(dark);

  valuesRef.current = values;
  selectedRef.current = selected;
  divergingRef.current = diverging;
  onSelectRef.current = onSelect;
  formatRef.current = formatValue;
  labelRef.current = metricLabel;
  darkRef.current = dark;

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

    const outline = () => (darkRef.current ? "#e2e8f0" : "#0f172a");

    const geoLayer = L.geoJSON(geojson as unknown as GeoJSON.GeoJsonObject, {
      style: (feature) => {
        const code = feature?.properties?.district_code as string | undefined;
        const value = code ? valuesRef.current[code] : null;
        return {
          fillColor: colorFor(value),
          fillOpacity: 0.8,
          color: code === selectedRef.current ? outline() : divergingRef.current ? "#cbd5e1" : "#ffffff",
          weight: code === selectedRef.current ? 3 : 1,
        };
      },
      onEachFeature: (feature, featureLayer) => {
        const code = feature.properties?.district_code as string;
        const path = featureLayer as L.Path;
        path.on({
          click: () => onSelectRef.current(code),
          mouseover: () => {
            path.setStyle({ weight: 2.5, color: darkRef.current ? "#f8fafc" : "#334155" });
            path.bringToFront();
          },
          mouseout: () => {
            path.setStyle({
              weight: code === selectedRef.current ? 3 : 1,
              color:
                code === selectedRef.current
                  ? outline()
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
    if (bounds.isValid()) instance.fitBounds(bounds, { padding: [8, 8], maxZoom: 10 });
    map.current = instance;

    // Panels resize when the rail collapses, the theme swaps or the window moves.
    const observer = new ResizeObserver(() => {
      instance.invalidateSize({ animate: false });
    });
    observer.observe(container.current);
    const frame = window.requestAnimationFrame(() => instance.invalidateSize({ animate: false }));

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      instance.remove();
      map.current = null;
      layer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geojson]);

  useEffect(() => {
    const geoLayer = layer.current;
    if (!geoLayer) return;
    const outline = dark ? "#e2e8f0" : "#0f172a";
    geoLayer.setStyle((feature) => {
      const code = feature?.properties?.district_code as string | undefined;
      const value = code ? values[code] : null;
      return {
        fillColor: colorFor(value),
        fillOpacity: 0.8,
        color: code === selected ? outline : diverging ? "#cbd5e1" : "#ffffff",
        weight: code === selected ? 3 : 1,
      };
    });
    geoLayer.eachLayer((featureLayer) => {
      const feature = (featureLayer as L.Path & { feature?: GeoJSON.Feature }).feature;
      if (!feature) return;
      const code = feature.properties?.district_code as string;
      const name = feature.properties?.name_en as string;
      const value = values[code];
      (featureLayer as L.Path)
        .unbindTooltip()
        .bindTooltip(
          `<div style="font-family:Inter,sans-serif;font-size:12px"><strong>${name}</strong><br/>${metricLabel}: ${formatValue(value ?? null)}</div>`,
          { sticky: true, direction: "top", className: "hka-map-tooltip", opacity: 1 },
        );
    });
  }, [values, selected, colorFor, diverging, formatValue, metricLabel, dark]);

  const fill = height === "100%";

  return (
    <div className="map-wrap" style={fill ? { height: "100%" } : undefined}>
      <div
        ref={container}
        className="map-canvas"
        style={fill ? undefined : { height }}
        role="img"
        aria-label="Choropleth map of Hong Kong's 18 districts"
      />
      <div className="map-legend">
        <div className="flex items-center gap-1.5">
          <span className="tabular-nums">{formatValue(min)}</span>
          <div className="relative w-24">
            <span className="block h-1.5 w-full rounded-full" style={{ background: gradient }} />
            {diverging && min < 0 && max > 0 ? (
              <span
                className="absolute -top-0.5 h-2.5 w-px -translate-x-1/2 bg-slate-500/70"
                style={{ left: `${zeroPct}%` }}
              />
            ) : null}
          </div>
          <span className="tabular-nums">{formatValue(max)}</span>
        </div>
        <span className="map-hint">Click to select · grey = no data</span>
      </div>
    </div>
  );
}
