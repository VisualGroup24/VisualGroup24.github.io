import { useLocation, useNavigate } from "react-router-dom";
import { useDataNote } from "./DataNote";
import Segmented from "./Segmented";
import { useDistrictData } from "../data/useDistrictData";
import { fmtMoney, fmtPctPlain } from "../lib/format";
import {
  maxAffordablePrice,
  maxRent,
  paymentForPrice,
  stressedPayment,
  type BudgetInput,
} from "../lib/journey";
import { useJourney } from "../state/journey";
import type { Tenure } from "../lib/filterUrl";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function moneyShort(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value <= 0) return "HK$0";
  if (value >= 1_000_000) return `HK$${(value / 1_000_000).toFixed(2)}M`;
  return fmtMoney(value);
}

function toNumber(raw: string, fallback = 0): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export default function BriefRail() {
  const brief = useJourney();
  const { data } = useDistrictData();
  const { open } = useDataNote();
  const navigate = useNavigate();
  const location = useLocation();

  const budget: BudgetInput = {
    monthlyIncome: brief.monthlyIncome,
    depositPct: brief.depositPct,
    mortgageRate: brief.mortgageRate,
    loanYears: brief.loanYears,
    dsrCap: brief.dsrCap,
  };
  const hasPath = brief.tenure !== null;
  const isRent = brief.tenure === "rent";
  const ceiling = maxAffordablePrice(budget);
  const payment = paymentForPrice(ceiling, budget);
  const stressed = stressedPayment(ceiling, budget);
  const rentCeiling = maxRent(brief.monthlyIncome, brief.rtiCap);

  const districts = [...(data?.districts ?? [])].sort((a, b) => a.name_en.localeCompare(b.name_en));
  const onMarket = location.pathname === "/market";

  return (
    <aside className="rail" aria-label="Your brief">
      <div className="rail-group">
        <span className="rail-label">
          Path
          <button
            type="button"
            className="btn btn-icon"
            aria-label="How the brief is used"
            title="How the brief is used"
            onClick={() => open("journey-brief")}
          >
            ?
          </button>
        </span>
        <Segmented<Tenure>
          options={[
            { value: "sale", label: "Buy" },
            { value: "rent", label: "Rent" },
          ]}
          value={brief.tenure ?? "sale"}
          onChange={brief.setTenure}
          label="Buy or rent"
        />
      </div>

      <div className="rail-group">
        <label className="rail-label" htmlFor="rail-income">
          Household income
          <span className="rail-value">{moneyShort(brief.monthlyIncome)}/mo</span>
        </label>
        <input
          id="rail-income"
          className="rail-input"
          type="number"
          inputMode="numeric"
          min={0}
          max={1_000_000}
          step={1_000}
          value={brief.monthlyIncome === 0 ? "" : brief.monthlyIncome}
          onChange={(event) => brief.setMonthlyIncome(clamp(toNumber(event.target.value), 0, 1_000_000))}
        />
        <input
          className="rail-range"
          type="range"
          min={10_000}
          max={200_000}
          step={1_000}
          value={clamp(brief.monthlyIncome, 10_000, 200_000)}
          aria-label="Household income slider"
          onChange={(event) => brief.setMonthlyIncome(toNumber(event.target.value))}
        />
      </div>

      <div className="rail-group">
        <label className="rail-label" htmlFor="rail-size">
          Flat size
          <span className="rail-value">{brief.flatSize} ft²</span>
        </label>
        <input
          id="rail-size"
          className="rail-range"
          type="range"
          min={200}
          max={800}
          step={10}
          value={brief.flatSize}
          onChange={(event) => brief.setFlatSize(toNumber(event.target.value))}
        />
      </div>

      {isRent ? (
        <div className="rail-group">
          <span className="rail-label">
            Rent-to-income cap
            <span className="rail-value">{fmtPctPlain(brief.rtiCap, 0)}</span>
          </span>
          <Segmented<number>
            options={[
              { value: 30, label: "30%" },
              { value: 40, label: "40%" },
              { value: 50, label: "50%" },
            ]}
            value={brief.rtiCap}
            onChange={brief.setRtiCap}
            label="Rent-to-income cap"
            size="sm"
          />
        </div>
      ) : (
        <>
          <div className="rail-group">
            <label className="rail-label" htmlFor="rail-deposit">
              Deposit
              <span className="rail-value">{fmtPctPlain(brief.depositPct, 0)}</span>
            </label>
            <input
              className="rail-range"
              type="range"
              min={5}
              max={90}
              step={5}
              value={brief.depositPct}
              aria-label="Deposit percentage"
              onChange={(event) => brief.setDepositPct(toNumber(event.target.value))}
            />
            <input
              id="rail-deposit"
              className="rail-input"
              type="number"
              min={0}
              max={95}
              step={1}
              value={brief.depositPct}
              aria-label="Deposit percentage exact value"
              onChange={(event) => brief.setDepositPct(clamp(toNumber(event.target.value), 0, 95))}
            />
          </div>

          <div className="rail-group">
            <label className="rail-label" htmlFor="rail-rate">
              Mortgage rate
              <span className="rail-value">{fmtPctPlain(brief.mortgageRate, 2)}</span>
            </label>
            <input
              id="rail-rate"
              className="rail-input"
              type="number"
              min={0}
              max={20}
              step={0.05}
              value={brief.mortgageRate}
              onChange={(event) => brief.setMortgageRate(clamp(toNumber(event.target.value), 0, 20))}
            />
          </div>

          <div className="rail-group">
            <span className="rail-label">
              DSR cap
              <span className="rail-value">{fmtPctPlain(brief.dsrCap, 0)}</span>
            </span>
            <Segmented<number>
              options={[
                { value: 40, label: "40%" },
                { value: 50, label: "50%" },
                { value: 60, label: "60%" },
              ]}
              value={brief.dsrCap}
              onChange={brief.setDsrCap}
              label="Debt servicing ratio cap"
              size="sm"
            />
          </div>

          <div className="rail-group">
            <label className="rail-label" htmlFor="rail-years">
              Loan term
              <span className="rail-value">{brief.loanYears} yrs</span>
            </label>
            <select
              id="rail-years"
              className="rail-select"
              value={brief.loanYears}
              onChange={(event) => brief.setLoanYears(toNumber(event.target.value))}
            >
              {[10, 15, 20, 25, 30, 35, 40].map((years) => (
                <option key={years} value={years}>
                  {years} years
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className="rail-summary">
        {isRent ? (
          <>
            <span className="rail-kv accent">
              Maximum rent <strong>{moneyShort(rentCeiling)}/mo</strong>
            </span>
            <span className="rail-kv">
              Rent-to-income <strong>{fmtPctPlain(brief.rtiCap, 0)}</strong>
            </span>
            <span className="rail-note">Based on current estate rents only; modelled history is not used for budgets.</span>
          </>
        ) : (
          <>
            <span className="rail-kv accent">
              Maximum price <strong>{moneyShort(ceiling)}</strong>
            </span>
            <span className="rail-kv">
              Monthly payment <strong>{moneyShort(payment)}</strong>
            </span>
            <span className="rail-kv">
              DSR at ceiling <strong>{fmtPctPlain(brief.dsrCap, 0)}</strong>
            </span>
            <span className="rail-kv">
              After +200 bp <strong>{moneyShort(stressed)}</strong>
            </span>
            {brief.monthlyIncome <= 0 ? (
              <span className="rail-note">
                Set an income to compute a ceiling; the stage still shows what the market costs.
              </span>
            ) : null}
          </>
        )}
      </div>

      {!onMarket || hasPath ? (
        <div className="rail-group">
          <label className="rail-label" htmlFor="rail-district">
            District
            <span className="rail-value">{brief.shortlist.length} shortlisted</span>
          </label>
          <select
            id="rail-district"
            className="rail-select"
            value={brief.selectedDistrict ?? ""}
            onChange={(event) => brief.setSelectedDistrict(event.target.value || null)}
          >
            <option value="">All Hong Kong</option>
            {districts.map((district) => (
              <option key={district.district_code} value={district.district_code}>
                {district.name_en}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="rail-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            brief.reset();
            navigate("/");
          }}
        >
          Reset brief
        </button>
        <span className="rail-note ml-auto">Saved in the URL</span>
      </div>
    </aside>
  );
}
