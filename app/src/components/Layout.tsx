import { Suspense, useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { buildFilterSearch, parseFilterSearch } from "../lib/filterUrl";
import { useFilters } from "../state/filters";
import { LoadingCard } from "./Cards";

const TABS = [
  { to: "/market", label: "Market Trends", short: "Market" },
  { to: "/districts", label: "District Explorer", short: "Districts" },
  { to: "/affordability", label: "Financing & Affordability", short: "Affordability" },
];

function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("hka-theme") === "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    window.localStorage.setItem("hka-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <button
      type="button"
      onClick={() => setDark((value) => !value)}
      className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:text-[var(--text)]"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {dark ? "Light" : "Dark"}
    </button>
  );
}

export default function Layout() {
  const selectedDistrict = useFilters((state) => state.selectedDistrict);
  const compareDistrict = useFilters((state) => state.compareDistrict);
  const tenure = useFilters((state) => state.tenure);
  const propertyClass = useFilters((state) => state.propertyClass);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from a shared link, then keep the URL in sync without adding
  // history entries for every filter click.
  useEffect(() => {
    useFilters.setState(parseFilterSearch(window.location.search));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const filterSearch = buildFilterSearch({
      selectedDistrict,
      compareDistrict,
      tenure,
      propertyClass,
    });
    const url = `${window.location.pathname}${filterSearch}${window.location.hash}`;
    window.history.replaceState(null, "", url);
  }, [hydrated, selectedDistrict, compareDistrict, tenure, propertyClass]);

  const filterSearch = buildFilterSearch({
    selectedDistrict,
    compareDistrict,
    tenure,
    propertyClass,
  });

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link to={{ pathname: "/", search: filterSearch }} className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-800 text-sm font-bold text-white">
              HK
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-tight">Housing Atlas</span>
              <span className="hidden text-[11px] text-[var(--text-muted)] sm:block">
                Private housing · 18 districts
              </span>
            </span>
          </Link>

          <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Dashboards">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={{ pathname: tab.to, search: filterSearch }}
                className={({ isActive }) =>
                  [
                    "rounded-full px-3 py-1.5 text-sm transition",
                    isActive
                      ? "bg-teal-800 text-white"
                      : "text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text)]",
                  ].join(" ")
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-full border border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--text-muted)] lg:inline">
              Data as of Oct 2026
            </span>
            <ThemeToggle />
          </div>
        </div>

        <nav
          className="flex gap-1 overflow-x-auto border-t border-[var(--border)] px-4 py-2 md:hidden"
          aria-label="Dashboards"
        >
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={{ pathname: tab.to, search: filterSearch }}
              className={({ isActive }) =>
                [
                  "whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition",
                  isActive
                    ? "bg-teal-800 text-white"
                    : "text-[var(--text-muted)] hover:bg-black/5",
                ].join(" ")
              }
            >
              {tab.short}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="app-main mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <Suspense fallback={<LoadingCard height={360} message="Loading dashboard…" />}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="app-footer mt-8 border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            Built from RVD, HKMA, C&amp;SD, Land Registry, HAD and derived Squarefoot data. For
            research and illustration; not financial advice.
          </p>
          <div className="flex gap-4">
            <Link to={{ pathname: "/methods", search: filterSearch }} className="underline-offset-2 hover:underline">
              Methods &amp; data
            </Link>
            <a
              href="https://data.gov.hk/"
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 hover:underline"
            >
              data.gov.hk
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
