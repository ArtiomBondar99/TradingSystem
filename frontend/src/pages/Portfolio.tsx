import { PositionsTable } from '../components/portfolio/PositionsTable';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { Panel } from '../components/ui/Panel';
import { usePortfolio } from '../hooks/usePortfolio';
import { formatMoney } from '../lib/format';

// Allocation chart and transaction history arrive in Phase 5
export default function Portfolio() {
  const portfolio = usePortfolio();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">Portfolio</h1>
        {portfolio.data && (
          <p className="text-sm text-muted">
            Total equity{' '}
            <span className="font-medium text-fg tabular-nums">
              {formatMoney(portfolio.data.totalValue)}
            </span>
          </p>
        )}
      </div>

      {portfolio.isError && <ErrorMessage error={portfolio.error} />}

      <Panel title="Positions">
        {portfolio.isPending && (
          <p className="p-4 text-sm text-muted">Loading…</p>
        )}
        {portfolio.data && (
          <PositionsTable positions={portfolio.data.positions} />
        )}
      </Panel>
    </div>
  );
}
