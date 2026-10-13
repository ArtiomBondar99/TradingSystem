import {
  CandlestickSeries,
  ColorType,
  createChart,
  createTextWatermark,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  TickMarkType,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';
import type { Candle, Timeframe } from '../../services/types';
import { ChartLegend } from './ChartLegend';

export type ChartType = 'candles' | 'line';

type Props = {
  candles: Candle[];
  timeframe: Timeframe;
  chartType: ChartType;
  // Changes when the user picks another symbol or timeframe: the chart then
  // re-centres on the latest bars. A background refresh keeps their zoom.
  resetKey: string;
  // Big faint text across the chart, e.g. "SIMULATED DATA"
  watermark?: string;
};

// Same palette as the Tailwind theme (index.css)
const COLORS = {
  background: '#1e222d',
  text: '#787b86',
  grid: '#2a2e39',
  up: '#26a69a',
  down: '#ef5350',
  line: '#2962ff',
  volumeUp: 'rgba(38, 166, 154, 0.35)',
  volumeDown: 'rgba(239, 83, 80, 0.35)',
};

// How many of the most recent bars are visible after a reset
const VISIBLE_BARS = 120;

type ChartParts = {
  chart: IChartApi;
  candles: ISeriesApi<'Candlestick'>;
  line: ISeriesApi<'Line'>;
  volume: ISeriesApi<'Histogram'>;
};

/**
 * TradingView Lightweight Charts wrapped in React. The library draws on a
 * <canvas> and has its own imperative API, so the pattern is: create the
 * chart ONCE in an effect, keep it in a ref, and push changes to it from
 * other effects. React never re-renders the canvas itself.
 */
export function PriceChart({
  candles,
  timeframe,
  chartType,
  resetKey,
  watermark,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const partsRef = useRef<ChartParts | null>(null);
  const fittedKeyRef = useRef<string | null>(null);
  const candlesByTimeRef = useRef(new Map<number, Candle>());
  const [hovered, setHovered] = useState<Candle | null>(null);

  // 1. Create the chart once, destroy it on unmount
  useEffect(() => {
    const chart = createChart(containerRef.current!, {
      // Follows the container's size (ResizeObserver): responsive for free
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: COLORS.background },
        textColor: COLORS.text,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: COLORS.grid },
        horzLines: { color: COLORS.grid },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: COLORS.grid },
      timeScale: { borderColor: COLORS.grid, rightOffset: 5 },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: COLORS.up,
      downColor: COLORS.down,
      wickUpColor: COLORS.up,
      wickDownColor: COLORS.down,
      borderVisible: false,
    });
    const lineSeries = chart.addSeries(LineSeries, {
      color: COLORS.line,
      lineWidth: 2,
      visible: false,
    });
    // Volume bars along the bottom fifth, on their own hidden price scale
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    // Keep the price bars above the volume
    candleSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.1, bottom: 0.25 },
    });

    // The legend shows the bar under the crosshair (or the latest one)
    chart.subscribeCrosshairMove((param) => {
      const time = param.time as number | undefined;
      setHovered(time ? (candlesByTimeRef.current.get(time) ?? null) : null);
    });

    partsRef.current = {
      chart,
      candles: candleSeries,
      line: lineSeries,
      volume: volumeSeries,
    };

    return () => {
      chart.remove();
      partsRef.current = null;
    };
  }, []);

  // 2. Watermark
  useEffect(() => {
    const parts = partsRef.current;
    if (!parts || !watermark) return;

    const plugin = createTextWatermark(parts.chart.panes()[0], {
      horzAlign: 'center',
      vertAlign: 'center',
      lines: [
        { text: watermark, color: 'rgba(247, 166, 0, 0.12)', fontSize: 40 },
      ],
    });
    return () => plugin.detach();
  }, [watermark]);

  // 3. Time labels: New York time for intraday bars, the plain date for
  // daily/weekly bars (stamped at midnight UTC, so they're formatted in UTC)
  useEffect(() => {
    const intraday = timeframe !== '1D' && timeframe !== '1W';
    const formatter = (options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: intraday ? 'America/New_York' : 'UTC',
        ...options,
      });
    const year = formatter({ year: 'numeric' });
    const month = formatter({ month: 'short' });
    const day = formatter({ month: 'short', day: 'numeric' });
    const time = formatter({
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const full = intraday
      ? formatter({
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        })
      : formatter({
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });

    const toDate = (value: Time) => new Date((value as number) * 1000);

    partsRef.current?.chart.applyOptions({
      localization: {
        timeFormatter: (value: Time) => full.format(toDate(value)),
      },
      timeScale: {
        timeVisible: intraday,
        tickMarkFormatter: (value: Time, type: TickMarkType) => {
          const date = toDate(value);
          switch (type) {
            case TickMarkType.Year:
              return year.format(date);
            case TickMarkType.Month:
              return month.format(date);
            case TickMarkType.DayOfMonth:
              return day.format(date);
            default:
              return time.format(date);
          }
        },
      },
    });
  }, [timeframe]);

  // 4. Data: replace the series data whenever new bars arrive
  useEffect(() => {
    const parts = partsRef.current;
    if (!parts) return;

    candlesByTimeRef.current = new Map(candles.map((c) => [c.time, c]));
    const time = (c: Candle) => c.time as UTCTimestamp;

    parts.candles.setData(
      candles.map((c) => ({
        time: time(c),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    parts.line.setData(candles.map((c) => ({ time: time(c), value: c.close })));
    parts.volume.setData(
      candles.map((c) => ({
        time: time(c),
        value: c.volume,
        color: c.close >= c.open ? COLORS.volumeUp : COLORS.volumeDown,
      })),
    );

    // Re-centre only for a new symbol/timeframe, not for a refresh
    if (candles.length > 0 && fittedKeyRef.current !== resetKey) {
      parts.chart.timeScale().setVisibleLogicalRange({
        from: Math.max(candles.length - VISIBLE_BARS, 0),
        to: candles.length + 5,
      });
      fittedKeyRef.current = resetKey;
    }
  }, [candles, resetKey]);

  // 5. Candles or line: both series exist, only one is visible
  useEffect(() => {
    const parts = partsRef.current;
    parts?.candles.applyOptions({ visible: chartType === 'candles' });
    parts?.line.applyOptions({ visible: chartType === 'line' });
  }, [chartType]);

  const legendCandle = hovered ?? candles.at(-1) ?? null;

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      {legendCandle && <ChartLegend candle={legendCandle} />}
    </div>
  );
}
