import { Link } from 'react-router';
import { PositionsTable } from '../components/portfolio/PositionsTable';
import { MarketList } from '../components/trading/MarketList';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { Panel } from '../components/ui/Panel';
import { StatCard } from '../components/ui/StatCard';
import { usePortfolio } from '../hooks/usePortfolio';
import { useStocks } from '../hooks/useStocks';
import { formatMoney, formatSignedMoney, pnlColor } from '../lib/format';

export default function Dashboard() {
  const portfolio = usePortfolio();
  const stocks = useStocks();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <h1 className="text-lg font-semibold">Overview</h1>

      {portfolio.isError && <ErrorMessage error={portfolio.error} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {portfolio.data ? (
          <>
            <StatCard
              label="Total equity"
              value={formatMoney(portfolio.data.totalValue)}
              hint="Cash + positions"
            />
            <StatCard
              label="Cash available"
              value={formatMoney(portfolio.data.cashBalance)}
            />
            <StatCard
              label="Positions value"
              value={formatMoney(portfolio.data.positionsValue)}
              hint={`${portfolio.data.positions.length} open positions`}
            />
            <StatCard
              label="Unrealized P&L"
              value={formatSignedMoney(portfolio.data.unrealizedPnL)}
              valueClassName={pnlColor(portfolio.data.unrealizedPnL)}
              hint="If you sold everything now"
            />
          </>
        ) : (
          // Same size as the real cards, so nothing jumps when data arrives
          Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-[98px] animate-pulse rounded-lg border border-line bg-panel"
            />
          ))
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="Open positions"
          className="lg:col-span-2"
          action={
            <Link
              to="/portfolio"
              className="text-xs text-accent hover:underline"
            >
              View portfolio
            </Link>
          }
        >
          {portfolio.data && (
            <PositionsTable positions={portfolio.data.positions} />
          )}
        </Panel>

        <Panel title="Markets">
          {stocks.isError && (
            <div className="p-4">
              <ErrorMessage error={stocks.error} />
            </div>
          )}
          {stocks.data && <MarketList stocks={stocks.data} />}
        </Panel>
      </div>
    </div>
  );
}
