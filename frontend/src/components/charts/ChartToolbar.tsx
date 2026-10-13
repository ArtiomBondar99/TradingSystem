import type { Timeframe } from '../../services/types';
import { IndicatorMenu } from './IndicatorMenu';
import type { ChartType } from './PriceChart';

type Props = {
  // Only the timeframes the data provider supports
  timeframes: Timeframe[];
  timeframe: Timeframe;
  onTimeframeChange: (timeframe: Timeframe) => void;
  chartType: ChartType;
  onChartTypeChange: (chartType: ChartType) => void;
};

const button = (active: boolean) =>
  `rounded px-2 py-1 text-xs transition-colors ${
    active ? 'bg-panel-hover text-fg' : 'text-muted hover:text-fg'
  }`;

export function ChartToolbar({
  timeframes,
  timeframe,
  onTimeframeChange,
  chartType,
  onChartTypeChange,
}: Props) {
  return (
    <div className="flex items-center gap-1 border-b border-line px-2 py-1">
      {/* Scrolls sideways on narrow screens. The indicator menu stays out of
          it: a scrolling box would clip the menu's dropdown. */}
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
        {timeframes.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === timeframe}
            className={button(option === timeframe)}
            onClick={() => onTimeframeChange(option)}
          >
            {option}
          </button>
        ))}

        <span className="mx-2 h-4 w-px shrink-0 bg-line" />

        <button
          type="button"
          aria-pressed={chartType === 'candles'}
          className={button(chartType === 'candles')}
          onClick={() => onChartTypeChange('candles')}
        >
          Candles
        </button>
        <button
          type="button"
          aria-pressed={chartType === 'line'}
          className={button(chartType === 'line')}
          onClick={() => onChartTypeChange('line')}
        >
          Line
        </button>
      </div>

      <span className="mx-1 h-4 w-px shrink-0 bg-line" />
      <IndicatorMenu intraday={timeframe !== '1D' && timeframe !== '1W'} />
    </div>
  );
}
