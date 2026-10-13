import { useParams } from 'react-router';
import { MarketList } from '../components/trading/MarketList';
import { Panel } from '../components/ui/Panel';
import { useStocks } from '../hooks/useStocks';
import { formatMoney } from '../lib/format';

// Layout of the trading terminal. The chart arrives in Phase 3 and the
// order panel in Phase 4; for now the slots show what will go there.
export default function Trading() {
  const { symbol } = useParams();
  const stocks = useStocks();
  const selected = stocks.data?.find((stock) => stock.symbol === symbol);

  return (
    <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[240px_1fr_300px]">
      <Panel title="Markets">
        {stocks.data && <MarketList stocks={stocks.data} />}
      </Panel>

      <Panel
        title={selected ? `${selected.symbol} · ${selected.name}` : 'Chart'}
        action={
          selected && (
            <span className="text-sm tabular-nums">
              {formatMoney(selected.currentPrice)}
            </span>
          )
        }
      >
        <div className="flex min-h-[420px] items-center justify-center p-4 text-sm text-muted">
          {selected
            ? 'Candlestick chart coming in Phase 3'
            : 'Pick a stock from the list'}
        </div>
      </Panel>

      <Panel title="Order">
        <div className="p-4 text-sm text-muted">
          Buy / sell panel coming in Phase 4
        </div>
      </Panel>
    </div>
  );
}
