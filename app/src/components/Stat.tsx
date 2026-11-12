export type StatTone = "pos" | "neg" | "warn" | "neutral";

export type StatItem = {
  label: string;
  value: string;
  delta?: string;
  tone?: StatTone;
};

function toneClass(tone: StatTone | undefined): string {
  return tone && tone !== "neutral" ? `stat-delta ${tone}` : "stat-delta";
}

/** Six compact KPI cells across the top of every stage. */
export function KpiStrip({ items }: { items: StatItem[] }) {
  return (
    <div className="kpi-strip" aria-label="Key figures">
      {items.map((item, index) => (
        <div className="stat" key={index}>
          <p className="stat-label" title={item.label}>
            {item.label}
          </p>
          <p className="stat-value">{item.value}</p>
          <p className={toneClass(item.tone)} title={item.delta}>
            {item.delta ?? "\u00a0"}
          </p>
        </div>
      ))}
    </div>
  );
}

export function Stat({ item }: { item: StatItem }) {
  return (
    <div className="stat">
      <p className="stat-label">{item.label}</p>
      <p className="stat-value">{item.value}</p>
      <p className={toneClass(item.tone)}>{item.delta ?? "\u00a0"}</p>
    </div>
  );
}
