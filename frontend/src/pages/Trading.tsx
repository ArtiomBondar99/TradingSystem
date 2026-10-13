import { useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router';
import { PriceChart, type ChartType } from '../components/charts/PriceChart';
import { ChartToolbar } from '../components/charts/ChartToolbar';
import { MarketList } from '../components/trading/MarketList';
import { QuoteHeader } from '../components/trading/QuoteHeader';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { Panel } from '../components/ui/Panel';
import {
  useCandles,
  useMarketDataSource,
  useQuote,
} from '../hooks/useMarketData';
import { useStocks } from '../hooks/useStocks';
import { TIMEFRAMES, type Timeframe } from '../services/types';

const DEFAULT_SYMBOL = 'AAPL';
const DEFAULT_TIMEFRAME: Timeframe = '1D';

const isTimeframe = (value: string | null): value is Timeframe =>
  TIMEFRAMES.includes(value as Timeframe);

export default function Trading() {
  const { symbol } = useParams();

  // /trading alone opens a default chart
  if (!symbol) {
    return <Navigate to={`/trading/${DEFAULT_SYMBOL}`} replace />;
  }

  return <TradingTerminal symbol={symbol.toUpperCase()} />;
}

function TradingTerminal({ symbol }: { symbol: string }) {
  // The timeframe lives in the URL (?tf=1h): a refresh or a shared link
  // opens the same chart
  const [searchParams, setSearchParams] = useSearchParams();
  const [chartType, setChartType] = useState<ChartType>('candles');

  const source = useMarketDataSource();
  const stocks = useStocks();
  const quote = useQuote(symbol);

  const supported = source.data?.timeframes ?? [...TIMEFRAMES];
  const requested = searchParams.get('tf');
  const timeframe =
    isTimeframe(requested) && supported.includes(requested)
      ? requested
      : DEFAULT_TIMEFRAME;

  const candles = useCandles(symbol, timeframe);
  const name = stocks.data?.find((stock) => stock.symbol === symbol)?.name;
  const simulated = candles.data?.source.kind === 'SIMULATED';

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr_300px]">
      <Panel title="Markets" className="order-2 lg:order-1">
        {stocks.data && <MarketList stocks={stocks.data} />}
      </Panel>

      <section className="order-1 flex min-w-0 flex-col rounded-lg border border-line bg-panel lg:order-2">
        <QuoteHeader symbol={symbol} name={name} quote={quote.data} />
        <ChartToolbar
          timeframes={supported}
          timeframe={timeframe}
          onTimeframeChange={(tf) => setSearchParams({ tf })}
          chartType={chartType}
          onChartTypeChange={setChartType}
        />

        <div className="relative h-[420px] lg:h-[520px]">
          {candles.isError ? (
            <div className="p-4">
              <ErrorMessage error={candles.error} />
            </div>
          ) : (
            <PriceChart
              candles={candles.data?.candles ?? []}
              timeframe={timeframe}
              chartType={chartType}
              resetKey={`${symbol}:${timeframe}`}
              watermark={simulated ? 'SIMULATED DATA' : undefined}
            />
          )}
          {candles.isPending && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">
              Loading chart…
            </p>
          )}
        </div>
      </section>

      <Panel title="Order" className="order-3">
        <div className="p-4 text-sm text-muted">
          Buy / sell panel coming in Phase 4
        </div>
      </Panel>
    </div>
  );
}
