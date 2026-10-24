import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { DataInfo } from "../data/cardInfo";
import PcaScreeLoadings from "./PcaScreeLoadings";

type DataInfoContextValue = {
  open: (info: DataInfo, extra?: ReactNode) => void;
  close: () => void;
};

const DataInfoContext = createContext<DataInfoContextValue>({
  open: () => {},
  close: () => {},
});

export function useDataInfo() {
  return useContext(DataInfoContext);
}

function DataNoteDrawer({
  info,
  extra,
  onClose,
}: {
  info: DataInfo;
  extra?: ReactNode;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label="Close data note"
        className="absolute inset-0 cursor-default bg-slate-950/35 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-note-title"
        className="absolute right-0 top-0 flex h-full w-full max-w-[420px] flex-col border-l border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Data note
            </p>
            <h2 id="data-note-title" className="mt-1 text-base font-semibold leading-snug">
              {info.title}
            </h2>
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 text-sm">
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              What it is
            </h3>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text)]">{info.what}</p>
          </section>

          {extra ? <div className="mt-5">{extra}</div> : null}
          {info.extra === "pca" ? <PcaScreeLoadings /> : null}

          <section className="mt-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Source
            </h3>
            <ul className="mt-2 space-y-2">
              {info.sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group inline-flex items-start gap-1.5 text-[12px] leading-snug text-teal-800 underline decoration-dotted underline-offset-2 hover:text-teal-700 dark:text-teal-300"
                  >
                    <span>{source.label}</span>
                    <span aria-hidden="true" className="text-[10px] text-[var(--text-muted)] group-hover:text-teal-700">
                      ↗
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              How it is processed
            </h3>
            <ul className="mt-2 space-y-2">
              {info.processing.map((step) => (
                <li key={step} className="flex gap-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--text-muted)]" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-6 border-t border-[var(--border)] pt-3">
            <Link
              to="/methods"
              onClick={onClose}
              className="text-[11px] font-medium text-teal-800 underline underline-offset-2 dark:text-teal-300"
            >
              Full methodology &amp; data dictionary →
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}

export function DataInfoProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<{ info: DataInfo; extra?: ReactNode } | null>(null);
  const close = useCallback(() => setPanel(null), []);
  const open = useCallback((info: DataInfo, extra?: ReactNode) => setPanel({ info, extra }), []);

  return (
    <DataInfoContext.Provider value={{ open, close }}>
      {children}
      {panel ? <DataNoteDrawer info={panel.info} extra={panel.extra} onClose={close} /> : null}
    </DataInfoContext.Provider>
  );
}
