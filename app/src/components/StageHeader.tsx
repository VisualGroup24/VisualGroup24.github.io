import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { buildFilterSearch } from "../lib/filterUrl";
import { useJourney } from "../state/journey";

type Props = {
  eyebrow: string;
  title: string;
  question: string;
  actions?: ReactNode;
  next?: { to: string; label: string };
};

export default function StageHeader({ eyebrow, title, question, actions, next }: Props) {
  const brief = useJourney();
  const search = buildFilterSearch(brief);

  return (
    <header className="stage-header">
      <div className="min-w-0">
        <p className="stage-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="stage-question">{question}</p>
      </div>
      <div className="stage-actions">
        {actions}
        {next ? (
          <Link className="next-cta" to={{ pathname: next.to, search }}>
            {next.label} <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
    </header>
  );
}
