type Option<T extends string | number> = {
  value: T;
  label: string;
  title?: string;
};

type Props<T extends string | number> = {
  options: Array<Option<T>>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
};

export default function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: Props<T>) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          className={size === "sm" ? "seg sm" : "seg"}
          aria-pressed={option.value === value}
          title={option.title ?? option.label}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
