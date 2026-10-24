import type { ReactNode } from "react";
import { useDataInfo } from "./DataInfo";
import type { DataInfo } from "../data/cardInfo";

export function SectionCard({
  title,
  description,
  action,
  info,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  info?: DataInfo;
  children: ReactNode;
  className?: string;
}) {
  const { open } = useDataInfo();

  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      {title || description || action ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? (
              <h2 className="text-sm font-semibold tracking-tight sm:text-base">
                {info ? (
                  <button
                    type="button"
                    onClick={() => open(info)}
                    aria-label={`Open data note: ${title}`}
                    aria-haspopup="dialog"
                    className="group inline-flex items-center gap-1.5 rounded-sm text-left hover:text-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 dark:hover:text-teal-300"
                  >
                    <span className="underline decoration-transparent underline-offset-2 transition group-hover:decoration-current">
                      {title}
                    </span>
                    <span
                      aria-hidden="true"
                      className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border border-current text-[8px] font-semibold leading-none opacity-50 transition group-hover:opacity-100"
                    >
                      i
                    </span>
                  </button>
                ) : (
                  title
                )}
              </h2>
            ) : null}
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
  className = "",
  info,
}: {
  label: string;
  value: string;
  delta?: string | null;
  note?: string;
  accent?: "teal" | "amber" | "blue" | "neutral";
  className?: string;
  info?: DataInfo;
}) {
  const { open } = useDataInfo();
  const accents: Record<string, string> = {
    teal: "border-l-teal-700",
    amber: "border-l-amber-700",
    blue: "border-l-blue-600",
    neutral: "border-l-slate-400",
  };
  const content = (
    <>
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
    </>
  );
  const classes = `kpi-card card border-l-4 ${accents[accent]} p-4 ${className}`.trim();

  if (info) {
    return (
      <button
        type="button"
        onClick={() => open(info)}
        aria-label={`Open data note: ${label}`}
        aria-haspopup="dialog"
        className={`${classes} w-full cursor-pointer text-left transition hover:border-teal-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700`}
      >
        {content}
      </button>
    );
  }

  return <div className={classes}>{content}</div>;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  info,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label?: string;
  info?: DataInfo;
}) {
  const { open } = useDataInfo();
  return (
    <div className="flex items-center gap-2">
      {label ? (
        info ? (
          <button
            type="button"
            onClick={() => open(info)}
            aria-label={`Open data note: ${label}`}
            aria-haspopup="dialog"
            className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <span>{label}</span>
            <span
              aria-hidden="true"
              className="grid h-3.5 w-3.5 place-items-center rounded-full border border-current text-[8px] font-semibold leading-none opacity-60"
            >
              i
            </span>
          </button>
        ) : (
          <span className="text-xs text-[var(--text-muted)]">{label}</span>
        )
      ) : null}
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
