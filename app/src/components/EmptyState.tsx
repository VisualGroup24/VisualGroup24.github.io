import type { ReactNode } from "react";

export default function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div>
        <p className="empty-state-title">{title}</p>
        {children ? <div className="empty-state-body">{children}</div> : null}
      </div>
    </div>
  );
}

/** Sized like the final bento cells so nothing jumps when data lands. */
export function StageSkeleton() {
  return (
    <div className="stage" aria-busy="true" aria-label="Loading dashboard">
      <div className="stage-header">
        <div>
          <div className="h-2.5 w-24 animate-pulse rounded bg-[var(--panel-alt)]" />
          <div className="mt-2 h-4 w-52 animate-pulse rounded bg-[var(--panel-alt)]" />
          <div className="mt-2 h-2.5 w-80 animate-pulse rounded bg-[var(--panel-alt)]" />
        </div>
      </div>
      <div className="kpi-strip">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="stat" key={index}>
            <div className="h-2 w-16 animate-pulse rounded bg-[var(--panel-alt)]" />
            <div className="mt-1 h-4 w-20 animate-pulse rounded bg-[var(--panel-alt)]" />
          </div>
        ))}
      </div>
      <div className="bento">
        <div className="bento-row">
          {Array.from({ length: 2 }).map((_, index) => (
            <div className="panel" key={index}>
              <div className="panel-head">
                <div className="h-2.5 w-32 animate-pulse rounded bg-[var(--panel-alt)]" />
              </div>
              <div className="panel-body">
                <div className="h-full w-full animate-pulse rounded-md bg-[var(--panel-alt)]" />
              </div>
            </div>
          ))}
        </div>
        <div className="bento-row">
          {Array.from({ length: 2 }).map((_, index) => (
            <div className="panel" key={index}>
              <div className="panel-head">
                <div className="h-2.5 w-32 animate-pulse rounded bg-[var(--panel-alt)]" />
              </div>
              <div className="panel-body">
                <div className="h-full w-full animate-pulse rounded-md bg-[var(--panel-alt)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
