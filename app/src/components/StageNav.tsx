import { Fragment } from "react";
import { NavLink } from "react-router-dom";
import { buildFilterSearch } from "../lib/filterUrl";
import { useJourney } from "../state/journey";

export const STAGES = [
  { to: "/market", n: 1, label: "Market pulse", short: "Market" },
  { to: "/explore", n: 2, label: "District explorer", short: "Districts" },
  { to: "/shortlist", n: 3, label: "Shortlist", short: "Shortlist" },
] as const;

export default function StageNav({ visited }: { visited: string[] }) {
  const brief = useJourney();
  const search = buildFilterSearch(brief);

  return (
    <nav className="stepper" aria-label="Journey stages">
      {STAGES.map((stage, index) => (
        <Fragment key={stage.to}>
          {index > 0 ? <span className="step-sep" aria-hidden="true" /> : null}
          <NavLink
            to={{ pathname: stage.to, search }}
            end={stage.to === "/market"}
            title={`${stage.n}. ${stage.label}`}
            className={({ isActive }) =>
              ["step", isActive ? "active" : "", visited.includes(stage.to) ? "visited" : ""]
                .filter(Boolean)
                .join(" ")
            }
          >
            <span className="step-n" aria-hidden="true">
              {stage.n}
            </span>
            {stage.short}
          </NavLink>
        </Fragment>
      ))}
    </nav>
  );
}
