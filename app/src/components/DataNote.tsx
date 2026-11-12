import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { getDataNote, type DataNoteEntry } from "../data/cardInfo";

type DataNoteContextValue = {
  open: (id: string) => void;
  close: () => void;
};

const DataNoteContext = createContext<DataNoteContextValue>({
  open: () => {},
  close: () => {},
});

export function useDataNote() {
  return useContext(DataNoteContext);
}

function Drawer({ entry, onClose }: { entry: DataNoteEntry; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="drawer-backdrop">
      <button type="button" aria-label="Close data note" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-note-title"
        className="drawer move"
      >
        <div className="drawer-head">
          <div>
            <p className="drawer-eyebrow">Data note</p>
            <h2 id="data-note-title" className="drawer-title">
              {entry.title}
            </h2>
          </div>
          <button ref={closeButton} type="button" className="btn drawer-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="drawer-body">
          <section className="drawer-section">
            <h3 className="drawer-section-title">What it is</h3>
            <p>{entry.what}</p>
          </section>

          <section className="drawer-section">
            <h3 className="drawer-section-title">Source</h3>
            <ul className="drawer-list">
              {entry.sources.map((source) => (
                <li key={source.url}>
                  <a className="drawer-link" href={source.url} target="_blank" rel="noreferrer">
                    {source.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section className="drawer-section">
            <h3 className="drawer-section-title">How it is processed</h3>
            <ul className="drawer-list">
              {entry.processing.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </section>

          <section className="drawer-section">
            <Link to="/methods" onClick={onClose} className="drawer-link text-[11px] font-medium">
              Full methodology, sources and limitations →
            </Link>
          </section>
        </div>
      </aside>
    </div>
  );
}

export function DataNoteProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  const close = useCallback(() => setId(null), []);
  const open = useCallback((nextId: string) => setId(nextId), []);
  const entry = id ? getDataNote(id) : null;

  return (
    <DataNoteContext.Provider value={{ open, close }}>
      {children}
      {entry ? <Drawer entry={entry} onClose={close} /> : null}
    </DataNoteContext.Provider>
  );
}
