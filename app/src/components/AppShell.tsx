import { Suspense, useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import BriefRail from "./BriefRail";
import GuideDrawer from "./GuideDrawer";
import StageNav from "./StageNav";
import { StageSkeleton } from "./EmptyState";
import { buildFilterSearch, parseFilterSearch } from "../lib/filterUrl";
import { fmtMonth } from "../lib/format";
import { useMarket } from "../data/useMarket";
import { useJourney } from "../state/journey";
import { useTheme } from "../state/theme";

const VISITED_KEY = "hka-visited";

function loadVisited(): string[] {
  try {
    const raw = window.sessionStorage.getItem(VISITED_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export default function AppShell() {
  const location = useLocation();
  const brief = useJourney();
  const mode = useTheme((state) => state.mode);
  const toggleTheme = useTheme((state) => state.toggle);
  const { data: market } = useMarket();

  const [visited, setVisited] = useState<string[]>(loadVisited);
  const [guideOpen, setGuideOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // One-time rehydration from a shared link. The defaults render first, then
  // the brief snaps to the URL values before the first write-back.
  useEffect(() => {
    const parsed = parseFilterSearch(window.location.search);
    if (Object.keys(parsed).length) useJourney.setState(parsed);
    setHydrated(true);
  }, []);

  // Keep the URL in step with the brief without adding history entries.
  useEffect(() => {
    if (!hydrated) return;
    const search = buildFilterSearch(brief);
    const next = `${window.location.pathname}${search}${window.location.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) window.history.replaceState(null, "", next);
  }, [
    hydrated,
    brief.tenure,
    brief.selectedDistrict,
    brief.compareDistrict,
    brief.propertyClass,
    brief.monthlyIncome,
    brief.depositPct,
    brief.mortgageRate,
    brief.flatSize,
    brief.loanYears,
    brief.dsrCap,
    brief.rtiCap,
  ]);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    try {
      window.localStorage.setItem("hka-theme", mode);
    } catch {
      // Private mode: the theme still applies for this visit.
    }
  }, [mode]);

  useEffect(() => {
    const path = location.pathname;
    const isHome = path === "/";
    const isReference = path === "/methods";
    if (isHome || isReference) return;
    setVisited((previous) => {
      if (previous.includes(path)) return previous;
      const next = [...previous, path];
      try {
        window.sessionStorage.setItem(VISITED_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage failures; visited markers are cosmetic.
      }
      return next;
    });
  }, [location.pathname]);

  const search = buildFilterSearch(brief);
  const isHome = location.pathname === "/";
  const isReference = location.pathname === "/methods";
  const showJourney = !isHome && !isReference;
  const asOf = market?.as_of ? `RVD to ${fmtMonth(market.as_of)}` : "Loading data…";

  return (
    <div className="shell">
      <header className="topbar">
        <Link to={{ pathname: "/", search }} className="brand" aria-label="HK Housing Atlas home">
          <span className="brand-mark" aria-hidden="true">
            HK
          </span>
          <span>
            <span className="brand-name">Housing Atlas</span>
            <span className="brand-sub">Private housing · 18 districts</span>
          </span>
        </Link>

        {showJourney ? <StageNav visited={visited} /> : <span className="topbar-home-hint">A guided housing journey</span>}

        <div className="topbar-right">
          <span className="asof">{asOf}</span>
          <button type="button" className="btn btn-ghost" onClick={() => setGuideOpen(true)}>
            Guide &amp; data
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={toggleTheme}
            aria-label={mode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {mode === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      <div className={isReference || isHome ? "shell-body no-rail" : "shell-body"}>
        {isReference || isHome ? null : <BriefRail />}
        <main className={isReference ? "stage reference" : isHome ? "stage welcome" : "stage"}>
          <Suspense fallback={<StageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <GuideDrawer open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
