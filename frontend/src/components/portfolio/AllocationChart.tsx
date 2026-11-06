import { useLayoutEffect, useRef, useState } from 'react';
import { formatMoney } from '../../lib/format';
import type { Portfolio } from '../../services/types';

// Categorical colors (dark-mode steps), checked with the dataviz palette
// validator against our panel color #1e222d: lightness, chroma, color-blind
// separation of neighbours and contrast all pass. The ORDER is part of that
// check, so don't reorder or add colors without re-running it.
// Cash always gets the first color: it's always there, so its color never
// moves. A color follows what it stands for, not a rank.
const CASH_COLOR = '#3987e5';
const POSITION_COLORS = ['#d95926', '#199e70', '#c98500', '#d55181'];
// "Other" is a bucket, not a series: neutral grey, never a 6th hue
const OTHER_COLOR = '#787b86';

// At most 6 blocks (cash + 4 stocks + Other): more than that and nobody can
// read the bar. Every holding is still listed in the table below it.
const MAX_POSITION_BLOCKS = POSITION_COLORS.length;
const GAP_PX = 2;

type Part = {
  key: string;
  label: string;
  // Numbers for drawing only: the exact amounts come from the server
  value: number;
  percent: number;
  color: string;
};

type Props = { portfolio: Portfolio };

export function AllocationChart({ portfolio }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const [barWidth, setBarWidth] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const hasPositions = portfolio.positions.length > 0;

  // Labels are printed inside a block only if they fit, so we need the
  // bar's real width in pixels (it changes with the window). Re-run when the
  // bar appears: it isn't rendered at all before the first trade.
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const observer = new ResizeObserver(([entry]) =>
      setBarWidth(entry.contentRect.width),
    );
    observer.observe(bar);
    return () => observer.disconnect();
  }, [hasPositions]);

  if (!hasPositions) {
    return (
      <p className="p-4 text-sm text-muted">
        100% cash. Your allocation appears after your first trade.
      </p>
    );
  }

  const parts = buildParts(portfolio);
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const drawable = Math.max(barWidth - GAP_PX * (parts.length - 1), 0);
  const activePart = parts.find((part) => part.key === active);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="relative">
        {activePart && (
          <Tooltip
            part={activePart}
            left={centerOf(activePart, parts, total)}
          />
        )}
        <div
          ref={barRef}
          className="flex h-7 w-full"
          style={{ gap: GAP_PX }}
          onPointerLeave={() => setActive(null)}
        >
          {parts.map((part) => {
            const label = `${Math.round(part.percent)}%`;
            const widthPx = (drawable * part.value) / total;
            // ~7px per character at 11px, plus padding on both sides
            const fits = widthPx >= label.length * 7 + 12;

            return (
              <div
                key={part.key}
                role="img"
                tabIndex={0}
                aria-label={`${part.label}: ${formatMoney(String(part.value))}, ${part.percent.toFixed(2)}%`}
                className="min-w-[2px] rounded outline-none hover:brightness-125 focus-visible:ring-2 focus-visible:ring-fg"
                style={{
                  flex: `${part.value} 1 0`,
                  backgroundColor: part.color,
                }}
                onPointerEnter={() => setActive(part.key)}
                onFocus={() => setActive(part.key)}
                onBlur={() => setActive(null)}
              >
                {fits && (
                  <span className="block pl-1.5 text-[11px] leading-7 font-medium text-white">
                    {label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Names only, in block order: the numbers are on the bar and below */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {parts.map((part) => (
          <li key={part.key} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm"
              style={{ backgroundColor: part.color }}
            />
            {part.label}
          </li>
        ))}
      </ul>

      <AllocationTable portfolio={portfolio} />
    </div>
  );
}

// The same split as numbers, every holding listed (nothing folded into
// "Other"): readable without hovering, by screen readers, and when two
// colors look alike. One neutral bar per row for comparing, largest first.
function AllocationTable({ portfolio }: Props) {
  const rows = [
    {
      key: 'cash',
      label: 'Cash',
      value: portfolio.cashBalance,
      percent: portfolio.cashPercent,
    },
    ...portfolio.positions.map((position) => ({
      key: position.symbol,
      label: position.symbol,
      value: position.marketValue,
      percent: position.allocationPercent,
    })),
  ].sort((a, b) => Number(b.value) - Number(a.value));

  const largest = Math.max(...rows.map((row) => Number(row.percent)), 1);

  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-muted">
        <tr className="border-b border-line">
          <th className="py-1.5 text-left font-normal">Holding</th>
          <th className="py-1.5 font-normal">
            <span className="sr-only">Share</span>
          </th>
          <th className="py-1.5 text-right font-normal">%</th>
          <th className="py-1.5 text-right font-normal">Value</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {rows.map((row) => (
          <tr key={row.key} className="border-b border-line last:border-0">
            <td className="py-1.5 pr-2 font-medium">{row.label}</td>
            <td className="w-full py-1.5 pr-3">
              {/* Square at the baseline (left), 4px round at the data end */}
              <div
                className="h-1.5 rounded-r bg-muted/60"
                style={{ width: `${(Number(row.percent) / largest) * 100}%` }}
              />
            </td>
            <td className="py-1.5 pr-3 text-right">
              {Number(row.percent).toFixed(1)}%
            </td>
            <td className="py-1.5 text-right whitespace-nowrap text-muted">
              {formatMoney(row.value)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Tooltip({ part, left }: { part: Part; left: number }) {
  return (
    <div
      className="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2 rounded border border-line bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg"
      // Kept inside the bar's box so it never runs off the panel
      style={{ left: `clamp(60px, ${left}%, calc(100% - 60px))` }}
    >
      {/* The value leads; the name is secondary, keyed by a short line */}
      <p className="font-semibold text-fg tabular-nums">
        {formatMoney(String(part.value))}{' '}
        <span className="font-normal text-muted">
          {part.percent.toFixed(2)}%
        </span>
      </p>
      <p className="mt-0.5 flex items-center gap-1.5 text-muted">
        <span
          className="h-0.5 w-3 rounded-full"
          style={{ backgroundColor: part.color }}
        />
        {part.label}
      </p>
    </div>
  );
}

// Cash first, then the biggest positions; the rest fold into "Other"
function buildParts(portfolio: Portfolio): Part[] {
  const positions = [...portfolio.positions].sort(
    (a, b) => Number(b.marketValue) - Number(a.marketValue),
  );
  const shown = positions.slice(0, MAX_POSITION_BLOCKS);
  const rest = positions.slice(MAX_POSITION_BLOCKS);

  const parts: Part[] = [
    {
      key: 'cash',
      label: 'Cash',
      value: Number(portfolio.cashBalance),
      percent: Number(portfolio.cashPercent),
      color: CASH_COLOR,
    },
    ...shown.map((position, index) => ({
      key: position.symbol,
      label: position.symbol,
      value: Number(position.marketValue),
      percent: Number(position.allocationPercent),
      color: POSITION_COLORS[index],
    })),
  ];

  if (rest.length > 0) {
    parts.push({
      key: 'other',
      label: `Other (${rest.length})`,
      value: rest.reduce((sum, p) => sum + Number(p.marketValue), 0),
      percent: rest.reduce((sum, p) => sum + Number(p.allocationPercent), 0),
      color: OTHER_COLOR,
    });
  }

  // A part worth $0 (e.g. no cash left) draws nothing
  return parts.filter((part) => part.value > 0);
}

// Horizontal middle of a block, in % of the bar: where its tooltip points
function centerOf(part: Part, parts: Part[], total: number): number {
  let before = 0;
  for (const p of parts) {
    if (p.key === part.key) break;
    before += p.value;
  }
  return ((before + part.value / 2) / total) * 100;
}
