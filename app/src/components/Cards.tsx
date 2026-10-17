import type { ReactNode } from "react";

export function SectionCard({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      {title || description || action ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-sm font-semibold tracking-tight sm:text-base">{title}</h2> : null}
            {description ? (
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--text-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  note,
  accent = "teal",
}: {
  label: string;
  value: string;
  delta?: string | null;
  note?: string;
  accent?: "teal" | "amber" | "blue" | "neutral";
}) {
  const accents: Record<string, string> = {
    teal: "border-l-teal-700",
    amber: "border-l-amber-600",
    blue: "border-l-blue-600",
    neutral: "border-l-slate-400",
  };
  return (
    <div className={`card border-l-4 ${accents[accent]} p-4`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {delta ? (
          <span
            className={
              delta.startsWith("-")
                ? "font-medium text-rose-700 dark:text-rose-400"
                : "font-medium text-emerald-700 dark:text-emerald-400"
            }
          >
            {delta}
          </span>
        ) : null}
        {note ? <span className="text-[var(--text-muted)]">{note}</span> : null}
      </div>
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {label ? <span className="text-xs text-[var(--text-muted)]">{label}</span> : null}
      <div
        role="group"
        aria-label={label}
        className="inline-flex rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] p-0.5"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={[
              "rounded-full px-2.5 py-1 text-xs font-medium transition",
              value === option.value
                ? "bg-teal-800 text-white"
                : "text-[var(--text-muted)] hover:text-[var(--text)]",
            ].join(" ")}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LoadingCard({ height = 240, message = "Loading data…" }: { height?: number; message?: string }) {
  return (
    <div
      className="card grid place-items-center text-sm text-[var(--text-muted)]"
      style={{ minHeight: height }}
    >
      {message}
    </div>
  );
}

export function ErrorCard({ message }: { message: string }) {
  return (
    <div className="card border-l-4 border-l-rose-600 p-5 text-sm">
      <p className="font-medium">Could not load the dataset.</p>
      <p className="mt-1 text-[var(--text-muted)]">{message}</p>
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        Run <code className="rounded bg-black/5 px-1 py-0.5">python -m pipeline.build</code> to
        regenerate <code className="rounded bg-black/5 px-1 py-0.5">app/public/data/latest/</code>.
      </p>
    </div>
  );
}
