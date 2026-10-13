// Always visible: this app never touches real money or a real exchange
export function SimulatedBadge() {
  return (
    <span
      className="rounded border border-warn/40 bg-warn/10 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-warn"
      title="Paper trading: virtual money and simulated order execution"
    >
      Paper trading · virtual money
    </span>
  );
}
