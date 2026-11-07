import { AllocationChart } from '../components/portfolio/AllocationChart';
import { PositionsTable } from '../components/portfolio/PositionsTable';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { Panel } from '../components/ui/Panel';
import { StatCard } from '../components/ui/StatCard';
import { usePortfolio } from '../hooks/usePortfolio';
import { formatMoney, formatSignedMoney, pnlColor } from '../lib/format';

export default function Portfolio() {
  const portfolio = usePortfolio();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <h1 className="text-lg font-semibold">Portfolio</h1>

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
              label="Unrealized P&L"
              value={formatSignedMoney(portfolio.data.unrealizedPnL)}
              valueClassName={pnlColor(portfolio.data.unrealizedPnL)}
              hint="Open positions, if sold now"
            />
            <StatCard
              label="Realized P&L"
              value={formatSignedMoney(portfolio.data.realizedPnL)}
              valueClassName={pnlColor(portfolio.data.realizedPnL)}
              hint="Locked in by your sales, after fees"
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

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <Panel title="Positions" className="lg:col-span-2">
          {portfolio.isPending && (
            <p className="p-4 text-sm text-muted">Loading…</p>
          )}
          {portfolio.data && (
            <PositionsTable positions={portfolio.data.positions} />
          )}
        </Panel>

        <Panel title="Allocation">
          {portfolio.isPending && (
            <p className="p-4 text-sm text-muted">Loading…</p>
          )}
          {portfolio.data && <AllocationChart portfolio={portfolio.data} />}
        </Panel>
      </div>
    </div>
  );
}
