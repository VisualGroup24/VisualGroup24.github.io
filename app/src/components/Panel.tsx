import type { ReactNode } from "react";
import { useDataNote } from "./DataNote";

type PanelProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
  noteId?: string;
  footer?: ReactNode;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
  className?: string;
  bodyClass?: string;
  padded?: boolean;
};

function Skeleton() {
  return (
    <div className="h-full w-full animate-pulse rounded-md bg-[var(--panel-alt)]" aria-hidden="true" />
  );
}

/** A bento cell: fixed head, flexible body and an optional data-note trigger. */
export default function Panel({
  title,
  subtitle,
  actions,
  children,
  noteId,
  footer,
  loading = false,
  error = null,
  empty = false,
  emptyMessage = "No data for this selection.",
  className,
  bodyClass,
  padded = false,
}: PanelProps) {
  const { open } = useDataNote();

  return (
    <section className={["panel", className].filter(Boolean).join(" ")}>
      <header className="panel-head">
        <div className="panel-titles">
          <h2 className="panel-title">{title}</h2>
          {subtitle ? <span className="panel-sub">{subtitle}</span> : null}
        </div>
        <div className="panel-tools">
          {actions}
          {noteId ? (
            <button
              type="button"
              className="btn btn-icon"
              aria-label={`Data note: ${title}`}
              title={`Data note: ${title}`}
              onClick={() => open(noteId)}
            >
              ?
            </button>
          ) : null}
        </div>
      </header>

      <div className={["panel-body", padded ? "pad" : "", bodyClass].filter(Boolean).join(" ")}>
        {error ? (
          <div className="panel-state">{error}</div>
        ) : loading ? (
          <Skeleton />
        ) : empty ? (
          <div className="panel-state">{emptyMessage}</div>
        ) : (
          children
        )}
      </div>

      {footer ? <div className="panel-footer">{footer}</div> : null}
    </section>
  );
}

export function Bento({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={["bento", className].filter(Boolean).join(" ")}>{children}</div>;
}

/** One bento row. `cols` is a CSS grid-template-columns value. */
export function BentoRow({ cols, children }: { cols: string; children: ReactNode }) {
  return (
    <div className="bento-row" style={{ gridTemplateColumns: cols }}>
      {children}
    </div>
  );
}
