import type { Tenure } from "../lib/filterUrl";
import { useJourney } from "../state/journey";

/**
 * The buy/rent choice. Used inside the stage-1 decision panel; choosing a path
 * switches the budget inputs and the variants of stages 2 and 3.
 */
export default function TenureChoice({ compact = false }: { compact?: boolean }) {
  const tenure = useJourney((state) => state.tenure);
  const setTenure = useJourney((state) => state.setTenure);

  const options: Array<{ value: Tenure; title: string; sub: string }> = [
    {
      value: "sale",
      title: "I'll buy",
      sub: "Mortgage ceiling, deposit, rate and DSR",
    },
    {
      value: "rent",
      title: "I'll rent",
      sub: "Monthly rent cap and rent-to-income",
    },
  ];

  return (
    <div className={compact ? "tenure-choice compact" : "tenure-choice"} role="group" aria-label="Choose buy or rent">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="choice"
          aria-pressed={tenure === option.value}
          onClick={() => setTenure(option.value)}
        >
          <span className="choice-title">{option.title}</span>
          <span className="choice-sub">{option.sub}</span>
        </button>
      ))}
    </div>
  );
}
