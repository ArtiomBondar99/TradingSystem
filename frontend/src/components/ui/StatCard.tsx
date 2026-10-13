type Props = {
  label: string;
  value: string;
  valueClassName?: string;
  hint?: string;
};

// One number on the dashboard: "Total equity  $100,000.00"
export function StatCard({ label, value, valueClassName = '', hint }: Props) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${valueClassName}`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
