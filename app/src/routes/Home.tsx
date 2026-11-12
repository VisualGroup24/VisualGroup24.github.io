import { Fragment } from "react";
import { Link } from "react-router-dom";
import { buildFilterSearch } from "../lib/filterUrl";
import { useJourney } from "../state/journey";
import { useTheme } from "../state/theme";

const STAGES = [
  {
    n: 1,
    title: "Market pulse",
    to: "/market",
    question: "Is it a buyer's or tenant's market?",
    detail:
      "Price and rent cycles, gross yield against mortgage rates, and the buy-versus-rent gap for the same flat. Choose buy or rent here to set the path for the rest.",
    meta: "Class · 5/10/all years · rent or buy",
    shot: "journey/market-yield",
    alt: "Gross yield plotted against effective HIBOR and BLR mortgage rates",
  },
  {
    n: 2,
    title: "District explorer",
    to: "/explore",
    question: "Which district can I afford?",
    detail:
      "A map, a district ranking, a budget-fit chart and a trend. Buyers see mortgage reach; tenants see rent burden and rent trends.",
    meta: "Metric · quarter · in budget · compare",
    shot: "journey/explore-map",
    alt: "Choropleth map of the 18 districts shaded by sale price per square foot",
  },
  {
    n: 3,
    title: "Shortlist",
    to: "/shortlist",
    question: "Which estates should I visit?",
    detail:
      "What your budget buys across current listings, a sortable shortlist table and an estate profile. Columns follow your tenure.",
    meta: "Budget cap · age · MTR · transactions",
    shot: "journey/shortlist-buys",
    alt: "Current listings plotted by saleable area and total asking price",
  },
] as const;

export default function Home() {
  const brief = useJourney();
  const mode = useTheme((state) => state.mode);
  const search = buildFilterSearch(brief);

  return (
    <div className="welcome">
      <header className="welcome-hero">
        <img
          className="welcome-qr"
          src={`${import.meta.env.BASE_URL}qr-visualgroup24.png`}
          alt="QR code for the HK Housing Atlas"
          title="Scan to open the atlas"
          width={394}
          height={394}
        />
        <div className="welcome-hero-copy">
          <p className="stage-eyebrow">Hong Kong private housing guide</p>
          <h1>A Practical Guide for Buyers and Tenants in HK</h1>
          <p className="welcome-lead">
            Official price and rent statistics meet estate-level transactions and current listings. The
            journey starts with the market cycle and ends with a visit list.
          </p>
          <div className="welcome-actions">
            <Link className="btn btn-primary btn-lg" to={{ pathname: "/market", search }}>
              Start exploring <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </header>

      <section className="journey-cards" aria-label="The three stages">
        {STAGES.map((stage, index) => (
          <Fragment key={stage.to}>
            {index > 0 ? (
              <div className={`journey-arrow journey-arrow-${index}`} aria-hidden="true" />
            ) : null}
            <article className="journey-card">
              <div className="journey-card-top">
                <span className="journey-n" aria-hidden="true">
                  {stage.n}
                </span>
                <span className="stage-eyebrow">{stage.title}</span>
              </div>
              <img
                className="journey-shot"
                src={`${import.meta.env.BASE_URL}${stage.shot}${mode === "dark" ? "-dark" : ""}.png`}
                alt={stage.alt}
                width={800}
                height={400}
                decoding="async"
              />
              <h2>{stage.question}</h2>
              <p>{stage.detail}</p>
              <p className="journey-meta">{stage.meta}</p>
            </article>
          </Fragment>
        ))}
      </section>

      <section className="welcome-facts" aria-label="What the journey uses">
        <div>
          <b>30 years</b>
          <span>RVD price, rent and yield indices, 1993–2026</span>
        </div>
        <div>
          <b>18 districts</b>
          <span>Land-only HAD boundaries with transaction panels</span>
        </div>
        <div>
          <b>Estate level</b>
          <span>Quarterly $/ft² history plus current sale and rent listings</span>
        </div>
      </section>

      <p className="welcome-note">
        <span>
          Built from RVD, HKMA, C&amp;SD, Land Registry, HAD and derived Squarefoot data. Rent history before the latest quarter is modelled.
        </span>
        <Link to="/methods" className="drawer-link">
          Methods & data →
        </Link>
      </p>
    </div>
  );
}
