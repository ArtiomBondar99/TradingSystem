import { Link } from 'react-router';
import {
  formatMoney,
  formatPercent,
  formatSignedMoney,
  pnlColor,
} from '../../lib/format';
import type { Position } from '../../services/types';

type Props = { positions: Position[] };

export function PositionsTable({ positions }: Props) {
  if (positions.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-muted">
        <p>No open positions yet.</p>
        <Link
          to="/trading"
          className="mt-2 inline-block text-accent hover:underline"
        >
          Place your first trade
        </Link>
      </div>
    );
  }

  return (
    // Scrolls sideways on narrow screens instead of squashing the columns
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead className="text-xs text-muted">
          <tr className="border-b border-line">
            <th className="px-4 py-2 text-left font-normal">Symbol</th>
            <th className="px-4 py-2 text-right font-normal">Qty</th>
            <th className="px-4 py-2 text-right font-normal">Avg price</th>
            <th className="px-4 py-2 text-right font-normal">Last</th>
            <th className="px-4 py-2 text-right font-normal">Market value</th>
            <th className="px-4 py-2 text-right font-normal">Unrealized P&L</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => (
            <tr
              key={position.symbol}
              className="border-b border-line last:border-0 hover:bg-panel-hover"
            >
              <td className="px-4 py-2">
                <Link
                  to={`/trading/${position.symbol}`}
                  className="font-medium hover:text-accent"
                >
                  {position.symbol}
                </Link>
                <span className="ml-2 hidden text-xs text-muted md:inline">
                  {position.name}
                </span>
              </td>
              <td className="px-4 py-2 text-right">{position.quantity}</td>
              <td className="px-4 py-2 text-right">
                {formatMoney(position.averagePrice)}
              </td>
              <td className="px-4 py-2 text-right">
                {formatMoney(position.currentPrice)}
              </td>
              <td className="px-4 py-2 text-right">
                {formatMoney(position.marketValue)}
              </td>
              <td
                className={`px-4 py-2 text-right ${pnlColor(position.unrealizedPnL)}`}
              >
                {formatSignedMoney(position.unrealizedPnL)}
                <span className="ml-2 text-xs">
                  {formatPercent(position.unrealizedPnLPercent)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
