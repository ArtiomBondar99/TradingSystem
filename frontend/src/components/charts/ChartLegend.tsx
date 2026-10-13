import type { Candle } from '../../services/types';

export type LegendValue = {
  label: string;
  color: string;
  value: number | null;
};

type Props = {
  candle: Candle;
  indicators?: LegendValue[];
};

const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

// The "O 190.10 H 191.00 L 189.50 C 190.80 V 1.2M" line in the chart's
// corner, then one line per indicator with its value at the same bar
export function ChartLegend({ candle, indicators = [] }: Props) {
  const up = candle.close >= candle.open;
  const color = up ? 'text-up' : 'text-down';
  const change = candle.close - candle.open;
  const changePercent = (change / candle.open) * 100;

  const value = (label: string, number: string) => (
    <span>
      <span className="text-muted">{label}</span>{' '}
      <span className={color}>{number}</span>
    </span>
  );

  return (
    // Translucent backdrop: readable on top of busy candles and lines
    <div className="pointer-events-none absolute top-2 left-2 z-10 flex flex-col gap-0.5 rounded bg-panel/80 px-1.5 py-1 text-xs tabular-nums">
      <div className="flex flex-wrap gap-x-3">
        {value('O', candle.open.toFixed(2))}
        {value('H', candle.high.toFixed(2))}
        {value('L', candle.low.toFixed(2))}
        {value('C', candle.close.toFixed(2))}
        <span className={color}>
          {change >= 0 ? '+' : ''}
          {change.toFixed(2)} ({changePercent >= 0 ? '+' : ''}
          {changePercent.toFixed(2)}%)
        </span>
        {value('Vol', compact.format(candle.volume))}
      </div>

      {indicators.map((indicator) => (
        <div key={indicator.label}>
          <span className="text-muted">{indicator.label}</span>{' '}
          <span style={{ color: indicator.color }}>
            {indicator.value === null ? '—' : indicator.value.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}
