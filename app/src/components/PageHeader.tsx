import type { ReactNode } from "react";

export default function PageHeader({
  eyebrow,
  title,
  question,
  children,
}: {
  eyebrow: string;
  title: string;
  question: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-800 dark:text-teal-300">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{question}</p>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}
