import type { Candle } from '../../services/types';

type Props = { candle: Candle };

const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

// The "O 190.10 H 191.00 L 189.50 C 190.80 V 1.2M" line in the chart's corner
export function ChartLegend({ candle }: Props) {
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
    <div className="pointer-events-none absolute top-2 left-3 z-10 flex flex-wrap gap-x-3 text-xs tabular-nums">
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
  );
}
