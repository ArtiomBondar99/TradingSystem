import {
  CandlestickSeries,
  ColorType,
  createChart,
  createTextWatermark,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  TickMarkType,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Candle, IndicatorPoint, Timeframe } from '../../services/types';
import { ChartLegend, type LegendValue } from './ChartLegend';
import type { ChartLayers } from './indicatorLayers';

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
  showVolume?: boolean;
  // Indicators, already turned into lines / levels / panes
  layers?: ChartLayers;
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
// Height of the price pane relative to each indicator pane (RSI, MACD)
const MAIN_PANE_STRETCH = 3;

const EMPTY_LAYERS: ChartLayers = { overlays: [], levels: [], panes: [] };

type ChartParts = {
  chart: IChartApi;
  candles: ISeriesApi<'Candlestick'>;
  line: ISeriesApi<'Line'>;
  volume: ISeriesApi<'Histogram'>;
};

type PaneState = {
  // Which panes/series exist; when it changes, the panes are rebuilt
  layout: string;
  series: Map<string, ISeriesApi<'Line'> | ISeriesApi<'Histogram'>>;
};

const toLineData = (points: IndicatorPoint[]) =>
  points.map((p) => ({ time: p.time as UTCTimestamp, value: p.value }));

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
  showVolume = true,
  layers = EMPTY_LAYERS,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const partsRef = useRef<ChartParts | null>(null);
  const fittedKeyRef = useRef<string | null>(null);
  const overlaysRef = useRef(new Map<string, ISeriesApi<'Line'>>());
  const priceLinesRef = useRef<
    { series: ISeriesApi<'Candlestick' | 'Line'>; line: IPriceLine }[]
  >([]);
  const panesRef = useRef<PaneState>({ layout: '', series: new Map() });
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);

  // 1. Create the chart once, destroy it on unmount
  useEffect(() => {
    const chart = createChart(containerRef.current!, {
      // Follows the container's size (ResizeObserver): responsive for free
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: COLORS.background },
        textColor: COLORS.text,
        attributionLogo: false,
        panes: { separatorColor: COLORS.grid },
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
      setHoveredTime((param.time as number | undefined) ?? null);
    });

    partsRef.current = {
      chart,
      candles: candleSeries,
      line: lineSeries,
      volume: volumeSeries,
    };

    const overlays = overlaysRef.current;
    const panes = panesRef.current;
    return () => {
      // Everything below dies with the chart; forget it before removing
      partsRef.current = null;
      overlays.clear();
      panes.series.clear();
      priceLinesRef.current = [];
      chart.remove();
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
    // Skip if the chart itself is already gone (unmount)
    return () => {
      if (partsRef.current) plugin.detach();
    };
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

  // 6. Volume on/off
  useEffect(() => {
    partsRef.current?.volume.applyOptions({ visible: showVolume });
  }, [showVolume]);

  // 7. Overlay lines on the price pane (SMA, EMA, Bollinger, VWAP):
  // remove the ones switched off, add new ones, update the rest
  useEffect(() => {
    const parts = partsRef.current;
    if (!parts) return;
    const existing = overlaysRef.current;
    const wanted = new Set(layers.overlays.map((layer) => layer.id));

    for (const [id, series] of existing) {
      if (!wanted.has(id)) {
        parts.chart.removeSeries(series);
        existing.delete(id);
      }
    }

    for (const layer of layers.overlays) {
      let series = existing.get(layer.id);
      if (!series) {
        series = parts.chart.addSeries(LineSeries, {
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        existing.set(layer.id, series);
      }
      series.applyOptions({
        color: layer.color,
        lineStyle: layer.dashed ? LineStyle.Dashed : LineStyle.Solid,
      });
      series.setData(toLineData(layer.points));
    }
  }, [layers.overlays]);

  // 8. Horizontal levels (pivots, support/resistance) on the visible main
  // series. Few and cheap: simply redrawn from scratch.
  useEffect(() => {
    const parts = partsRef.current;
    if (!parts) return;

    for (const { series, line } of priceLinesRef.current) {
      series.removePriceLine(line);
    }
    const target = chartType === 'candles' ? parts.candles : parts.line;
    priceLinesRef.current = layers.levels.map((level) => ({
      series: target,
      line: target.createPriceLine({
        price: level.price,
        color: level.color,
        title: level.title,
        lineWidth: 1,
        lineStyle: level.dashed ? LineStyle.Dashed : LineStyle.Solid,
        axisLabelVisible: true,
      }),
    }));
  }, [layers.levels, chartType]);

  // 9. Indicator panes below the price (RSI, MACD). Pane indexes shift when
  // one is removed, so if the set of panes changes we rebuild them all;
  // if only the data changed we just update it.
  useEffect(() => {
    const parts = partsRef.current;
    if (!parts) return;
    const state = panesRef.current;
    const layout = layers.panes
      .map((pane) =>
        [
          pane.id,
          ...pane.lines.map((l) => l.id),
          ...pane.histograms.map((h) => h.id),
        ].join(','),
      )
      .join('|');

    if (layout !== state.layout) {
      // Removing a pane's last series removes the (now empty) pane too
      for (const series of state.series.values()) {
        parts.chart.removeSeries(series);
      }
      state.series.clear();

      layers.panes.forEach((pane, i) => {
        const paneIndex = i + 1;
        for (const histogram of pane.histograms) {
          state.series.set(
            histogram.id,
            parts.chart.addSeries(
              HistogramSeries,
              { priceLineVisible: false, lastValueVisible: false },
              paneIndex,
            ),
          );
        }
        pane.lines.forEach((line, j) => {
          const series = parts.chart.addSeries(
            LineSeries,
            {
              color: line.color,
              lineWidth: 1,
              priceLineVisible: false,
              crosshairMarkerVisible: false,
            },
            paneIndex,
          );
          // Guides (RSI 30/70, MACD 0) hang off the pane's first line
          if (j === 0) {
            for (const guide of pane.guides) {
              series.createPriceLine({
                price: guide.price,
                color: guide.color,
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                axisLabelVisible: false,
              });
            }
          }
          state.series.set(line.id, series);
        });
      });

      const panes = parts.chart.panes();
      panes[0]?.setStretchFactor(panes.length > 1 ? MAIN_PANE_STRETCH : 1);
      state.layout = layout;
    }

    for (const pane of layers.panes) {
      for (const line of pane.lines) {
        state.series.get(line.id)?.setData(toLineData(line.points));
      }
      for (const histogram of pane.histograms) {
        state.series.get(histogram.id)?.setData(
          histogram.points.map((p) => ({
            time: p.time as UTCTimestamp,
            value: p.value,
            color: p.value >= 0 ? histogram.upColor : histogram.downColor,
          })),
        );
      }
    }
  }, [layers.panes]);

  // Legend: the bar and indicator values under the crosshair, else the latest
  const candlesByTime = useMemo(
    () => new Map(candles.map((c) => [c.time, c])),
    [candles],
  );
  const legendCandle =
    (hoveredTime !== null ? candlesByTime.get(hoveredTime) : undefined) ??
    candles.at(-1) ??
    null;
  const legendValues: LegendValue[] = [
    ...layers.overlays.filter(
      (layer) => !layer.id.startsWith('bb-') || layer.id === 'bb-middle',
    ),
    ...layers.panes.flatMap((pane) => pane.lines),
  ].map((layer) => ({
    label: layer.label,
    color: layer.color,
    value: valueAt(layer.points, legendCandle?.time),
  }));

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      {legendCandle && (
        <ChartLegend candle={legendCandle} indicators={legendValues} />
      )}
    </div>
  );
}

// The point at `time`, else the last one
function valueAt(
  points: IndicatorPoint[],
  time: number | undefined,
): number | null {
  const point =
    (time !== undefined && points.find((p) => p.time === time)) ||
    points.at(-1);
  return point ? point.value : null;
}
