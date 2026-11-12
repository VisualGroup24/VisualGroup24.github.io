import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

const STEPS = [
  {
    title: "Market pulse",
    detail: "Is it a buyer's or tenant's market? Prices, rents, yields against mortgage rates, and the buy-vs-rent gap. Choose rent or buy here.",
  },
  {
    title: "District explorer",
    detail: "See which districts your budget reaches, compare them on price or rent, movement and yield, and pick an area. The page changes for tenants and buyers.",
  },
  {
    title: "Shortlist",
    detail: "Filter estates by budget, age and MTR walk, check what your budget buys in current listings, and shortlist the visits.",
  },
];

export default function GuideDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="drawer-backdrop">
      <div className="drawer-scrim" aria-hidden="true" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-labelledby="guide-title" className="drawer">
        <div className="drawer-head">
          <div>
            <p className="drawer-eyebrow">Guide &amp; data</p>
            <h2 id="guide-title" className="drawer-title">
              How this journey works
            </h2>
          </div>
          <button ref={closeButton} type="button" className="btn drawer-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="drawer-body">
          <p className="muted text-[11px]">
            Three stages answer one question each. The first stage offers the choice — rent or buy —
            which sets the budgets and charts of the other two. Stages 2 and 3 stay open and show the
            buy path until you choose. Income, deposit or rent cap, flat size and district follow you
            and are mirrored into the URL.
          </p>

          <div className="guide-steps mt-3">
            {STEPS.map((step, index) => (
              <div className="guide-step" key={step.title}>
                <i aria-hidden="true">{index + 1}</i>
                <div>
                  <b>{step.title}</b>
                  <span>{step.detail}</span>
                </div>
              </div>
            ))}
          </div>

          <p className="hint mt-2">
            Stages 2 and 3 are always open. You can change the path later in the rail; your district
            and shortlist are kept.
          </p>

          <section className="drawer-section">
            <h3 className="drawer-section-title">Key definitions</h3>
            <ul className="drawer-list">
              <li>
                <span>
                  <b>$/ft²</b> — price ÷ saleable area; RVD m² figures are converted at 10.7639 ft²/m².
                </span>
              </li>
              <li>
                <span>
                  <b>Gross yield</b> — 12 × monthly rent/ft² ÷ sale price/ft²; fees and taxes are excluded.
                </span>
              </li>
              <li>
                <span>
                  <b>PTI / RTI</b> — price or rent of a standard 500 ft² flat against household income.
                </span>
              </li>
              <li>
                <span>
                  <b>DSR</b> — monthly mortgage payment ÷ monthly household income; the default cap is 50%.
                </span>
              </li>
            </ul>
          </section>

          <section className="drawer-section">
            <h3 className="drawer-section-title">Data</h3>
            <ul className="drawer-list">
              <li>30 years of RVD price, rent and yield indices, HKMA mortgage rates and C&amp;SD income.</li>
              <li>Estate-level transaction panels and current listings from Squarefoot, aggregated.</li>
              <li>Land-only 18-district boundaries from HAD and geohk.</li>
              <li>Rent history before the latest quarter is modelled from the RVD rental index.</li>
              <li>Asking prices are not transaction prices; affordability excludes stamp duty and fees.</li>
            </ul>
          </section>

          <section className="drawer-section">
            <h3 className="drawer-section-title">Share the journey</h3>
            <div className="guide-qr">
              <img
                src={`${import.meta.env.BASE_URL}qr-visualgroup24.png`}
                alt="QR code for the HK Housing Atlas"
                loading="lazy"
              />
              <p>
                Scan to open the atlas. The brief is encoded in the link, so the person opening it
                lands on the same stage with the same income, deposit and district.
              </p>
            </div>
          </section>

          <section className="drawer-section">
            <p className="muted text-[10px]">
              Built from RVD, HKMA, C&amp;SD, Land Registry, HAD and derived Squarefoot data. For
              research and illustration — not financial advice.
            </p>
            <Link to="/methods" onClick={onClose} className="drawer-link mt-2 inline-block text-[11px] font-medium">
              Methods, definitions and limitations →
            </Link>
          </section>
        </div>
      </aside>
    </div>
  );
}
