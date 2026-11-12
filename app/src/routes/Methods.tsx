import { Link } from "react-router-dom";
import { STAGES } from "../components/StageNav";

const SOURCES = [
  {
    name: "Rating and Valuation Department",
    what: "Private domestic price and rental indices 1993–, average prices/rents by class, gross yields 1999–, sales and completions.",
    href: "https://www.rvd.gov.hk/en/publications/property_market_statistics.html",
  },
  {
    name: "Hong Kong Monetary Authority",
    what: "Residential mortgage survey, 1-month HIBOR and best lending rate.",
    href: "https://www.hkma.gov.hk/eng/data-publications-and-research/data-and-statistics/monthly-statistical-bulletin/",
  },
  {
    name: "Census and Statistics Department",
    what: "Median monthly household income and average household size by District Council district, 2001–2025.",
    href: "https://www.censtatd.gov.hk/en/web_table.html?id=130-06806",
  },
  {
    name: "Land Registry",
    what: "Monthly sale and purchase agreement counts, consideration and the primary/secondary split.",
    href: "https://data.gov.hk/en-data/dataset/hk-lr-data4-landreg",
  },
  {
    name: "Home Affairs Department",
    what: "18 District Council boundary polygons and district codes used by the map.",
    href: "https://data.gov.hk/en-data/dataset/hk-had-json1-hong-kong-administrative-boundaries",
  },
  {
    name: "geohk / census2001",
    what: "Land-only district geometry used to remove sea from the HAD boundaries. Coastline vintage is 2001.",
    href: "https://github.com/hupili/geohk",
  },
  {
    name: "Squarefoot (28Hse group)",
    what: "Current sale/rent listings and estate-level quarterly price and rent series; derived statistics only.",
    href: "https://www.squarefoot.com.hk/",
  },
];

const DEFINITIONS = [
  ["$ / ft²", "Price ÷ saleable area. RVD per-m² values are converted at 10.7639 ft² per m²."],
  ["Gross yield", "12 × monthly rent per ft² ÷ sale price per ft². Management fees and taxes excluded."],
  ["Price-to-income", "Price of a standard 500 ft² flat ÷ annual median household income."],
  ["Rent-to-income", "Monthly rent of a standard 500 ft² flat ÷ monthly median household income."],
  ["DSR", "Monthly mortgage payment ÷ monthly household income. The buyer brief defaults to a 50% cap."],
  ["Property class", "RVD saleable-area bands: A <40 m², B 40–69.9, C 70–99.9, D 100–159.9, E ≥160 m²."],
  ["Modelled rent", "District rent history before the latest quarter = current rent × RVD rent index ÷ index at the latest quarter."],
  ["Asking premium", "Median asking $/ft² of current listings ÷ transaction-panel $/ft² − 1."],
];

const FORMULAS = [
  ["Maximum loan", "payment = income × DSR cap; loan = payment × (1 − (1 + r/12)^−months) ÷ (r/12)"],
  ["Maximum price", "loan ÷ (1 − deposit %); a deposit above 95% is treated as 95%"],
  ["Required income", "monthly payment ÷ DSR cap"],
  ["Maximum rent", "monthly income × rent-to-income cap"],
  ["Buy vs rent", "payment (70% LTV, 30 years, r = HIBOR + 1.3) against rent, both for 500 ft²"],
  ["Stressed ceiling", "the same maximum price recomputed at r + 2.00 percentage points"],
];

export default function Methods() {
  return (
    <div className="methods">
      <header className="methods-hero">
        <div>
          <p className="stage-eyebrow">Reference</p>
          <h1>Methods &amp; data</h1>
          <p className="lead">
            How every figure in the journey is computed, where it comes from, and what it cannot tell
            you. The app reads a static snapshot; nothing here is an estimate of your own mortgage
            offer or a valuation.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/" className="btn btn-ghost">
            Home
          </Link>
          <Link to="/market" className="btn btn-primary">
            Back to the journey <span aria-hidden="true">→</span>
          </Link>
        </div>
      </header>

      <div className="method-grid">
        <section className="method-card">
          <h2>The three stages</h2>
          <ul className="method-list">
            {STAGES.map((stage) => (
              <li key={stage.to}>
                <Link to={stage.to} className="drawer-link">
                  {stage.n}. {stage.label}
                </Link>
              </li>
            ))}
            <li>Home — the welcome page that explains the journey.</li>
            <li>Reference — this page, definitions, sources and limitations.</li>
          </ul>
          <p className="hint mt-2">
            Stage 1 offers the rent-or-buy choice. That choice changes the budgets, metrics, KPIs and
            profiles of stages 2 and 3, which stay open and show the buy path until you choose. The
            brief (tenure, income, deposit or rent cap, flat size and district) is shared and encoded
            in the URL.
          </p>
          <p className="hint mt-2">
            URL keys: <code>tenure</code> (<code>buy</code> or <code>rent</code>),{" "}
            <code>district</code>, <code>compare</code>, <code>class</code>, <code>income</code>,{" "}
            <code>deposit</code>, <code>rate</code>, <code>size</code>, <code>years</code>,{" "}
            <code>dsr</code>, <code>rti</code>. Legacy <code>tenure=sale</code> is accepted as{" "}
            <code>buy</code>. Old <code>/budget</code> and <code>/decide</code> links redirect into the
            new stages.
          </p>
        </section>

        <section className="method-card">
          <h2>Definitions</h2>
          <dl className="method-defs">
            {DEFINITIONS.map(([term, detail]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="method-card">
          <h2>Budget and affordability maths</h2>
          <div className="method-formulas">
            {FORMULAS.map(([label, formula]) => (
              <div key={label}>
                <p className="method-formula-label">{label}</p>
                <code>{formula}</code>
              </div>
            ))}
          </div>
          <p className="hint mt-2">
            Stamp duty, legal fees, agency fees, management fees and vacancy are excluded throughout.
            Affordability uses household income and a standard 500 ft² flat, not buyer income or the
            actual unit.
          </p>
        </section>

        <section className="method-card">
          <h2>District price, rent and yield</h2>
          <ul className="method-list">
            <li>
              Sale $/ft² is the <b>transaction-volume-weighted median</b> of estate $/ft² in that
              district and quarter.
            </li>
            <li>
              Current rent is the <b>rental-volume-weighted median</b> of estate rent $/ft² from the
              latest 90-day estate statistics.
            </li>
            <li>
              Earlier rent is modelled: current district rent × RVD rent index ÷ RVD index at the
              latest quarter. It holds district relativities fixed.
            </li>
            <li>
              The district explorer's box plot ranks the five estates with the most latest-quarter
              transactions and shows each estate's quarterly sale $/ft² history (Q1–Q3 box, median
              line, min–max whiskers).
            </li>
            <li>Gross yield = 12 × rent $/ft² ÷ sale $/ft²; values outside 0–15% are flagged.</li>
            <li>
              Estate quarterly averages outside HK$5,000–80,000/ft² (sale) or HK$5–300/ft² (rent) are
              treated as bad records and excluded.
            </li>
          </ul>
        </section>

        <section className="method-card">
          <h2>Coverage</h2>
          <table className="method-table">
            <tbody>
              <tr>
                <th>Territory indices</th>
                <td>1993-01 → 2026-08 · monthly · classes A–E, A,B&amp;C, D&amp;E, ALL</td>
              </tr>
              <tr>
                <th>Yields</th>
                <td>1999-01 → 2026-08 · classes A–E only</td>
              </tr>
              <tr>
                <th>Rates and mortgage</th>
                <td>HIBOR, BLR and mortgage survey to 2026-09</td>
              </tr>
              <tr>
                <th>Income</th>
                <td>2001–2025 · annual · 18 districts</td>
              </tr>
              <tr>
                <th>District panel</th>
                <td>1996-Q1 → 2026-Q4 · 124 quarters · app shows 2018+</td>
              </tr>
              <tr>
                <th>Estates and listings</th>
                <td>1,337 latest-quarter estates; 13,962 listings; 13,431 in the listing sample</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="method-card">
          <h2>Listing sample</h2>
          <ul className="method-list">
            <li>
              “What your budget buys” and the tenant rent distribution use the pipeline’s listing-level
              snapshot: saleable area, asking $/ft², district and tenure for 13,431 complete listings.
            </li>
            <li>It is a current asking snapshot, not a transaction record and not a random sample.</li>
            <li>Scatter axes are clipped at the 99th percentile; the reachable share is computed before clipping.</li>
            <li>No pricing model or dimension reduction is fitted; the records are used as they are.</li>
          </ul>
        </section>
      </div>

      <section className="method-card">
        <h2>Sources</h2>
        <ul className="method-sources">
          {SOURCES.map((source) => (
            <li key={source.name}>
              <a href={source.href} target="_blank" rel="noreferrer" className="drawer-link">
                {source.name}
              </a>
              <span>{source.what}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="method-card">
        <h2>Limitations</h2>
        <ul className="method-list">
          <li>
            The crawl is a current snapshot, not a ten-year listing panel. Long-run series come from
            RVD and the estate quarterly charts.
          </li>
          <li>
            District price series are estate-based, not a random sample of the housing stock; coverage
            varies by district and small cells are suppressed.
          </li>
          <li>
            Rent history before the latest quarter is modelled from the RVD rental index, not observed.
            Rent budgets use current estate rents only.
          </li>
          <li>
            Listing prices are asking prices and sit above transactions. Transactions are used for
            trend and yield calculations wherever available.
          </li>
          <li>
            Estate coordinates are unavailable, so estates are compared with scatter plots rather than
            a map. Estate panels can be volatile when the estate mix changes.
          </li>
          <li>The map uses a land-only 2001 coastline; reclamation after 2001 is not represented.</li>
          <li>Relationships shown are associations. Nothing here is a causal estimate or investment advice.</li>
        </ul>
      </section>

      <p className="hint">
        Built from RVD, HKMA, C&amp;SD, Land Registry, HAD and derived Squarefoot data. Data remains
        subject to each provider's terms; Squarefoot-derived figures are aggregated and anonymised.
      </p>
    </div>
  );
}
