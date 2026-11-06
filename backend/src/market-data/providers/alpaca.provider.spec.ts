import { jest } from '@jest/globals';
import { AlpacaMarketDataProvider, barsStart } from './alpaca.provider.js';
import { MarketDataUnavailableError } from './market-data.provider.js';

// Shapes copied from real Alpaca responses (trimmed to the fields we read)
const bar = (t: string, c: number) => ({
  t,
  o: c,
  h: c + 1,
  l: c - 1,
  c,
  v: 1000,
});

describe('AlpacaMarketDataProvider', () => {
  const fetchFn = jest.fn<typeof fetch>();
  const provider = new AlpacaMarketDataProvider(
    { keyId: 'KEY', secretKey: 'SECRET', dataUrl: 'https://data.test' },
    fetchFn,
  );

  const respond = (body: unknown, status = 200) =>
    fetchFn.mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status }),
    );

  // The URL and headers of the n-th request
  const request = (n = 0) => {
    const [url, init] = fetchFn.mock.calls[n];
    return {
      url: new URL(url as string),
      headers: init?.headers as Record<string, string>,
    };
  };

  beforeEach(() => fetchFn.mockReset());

  describe('getQuotes', () => {
    it('gets every symbol in ONE request, authenticated, from the IEX feed', async () => {
      respond({});

      await provider.getQuotes(['AAPL', 'MSFT']);

      expect(fetchFn).toHaveBeenCalledTimes(1);
      const { url, headers } = request();
      expect(url.origin + url.pathname).toBe(
        'https://data.test/v2/stocks/snapshots',
      );
      expect(url.searchParams.get('symbols')).toBe('AAPL,MSFT');
      expect(url.searchParams.get('feed')).toBe('iex');
      expect(headers).toEqual({
        'APCA-API-KEY-ID': 'KEY',
        'APCA-API-SECRET-KEY': 'SECRET',
      });
    });

    it('uses the latest trade, and yesterday as the previous close', async () => {
      respond({
        AAPL: {
          latestTrade: { t: '2026-11-05T20:59:58.412180667Z', p: 344.6 },
          dailyBar: bar('2026-11-05T05:00:00Z', 344.6),
          prevDailyBar: bar('2026-11-04T05:00:00Z', 349.554),
        },
      });

      const [quote] = await provider.getQuotes(['AAPL']);

      expect(quote).toEqual({
        symbol: 'AAPL',
        price: 344.6,
        previousClose: 349.55, // rounded to cents
        change: -4.95,
        changePercent: -1.42,
        timestamp: '2026-11-05T20:59:58.412Z',
      });
    });

    it('before today has a daily bar, the previous close is dailyBar', async () => {
      // A pre-market trade on 11-06: dailyBar is still 11-05's
      respond({
        AAPL: {
          latestTrade: { t: '2026-11-06T12:30:00Z', p: 346 },
          dailyBar: bar('2026-11-05T05:00:00Z', 344.6),
          prevDailyBar: bar('2026-11-04T05:00:00Z', 349.554),
        },
      });

      const [quote] = await provider.getQuotes(['AAPL']);

      expect(quote.previousClose).toBe(344.6);
      expect(quote.change).toBe(1.4);
    });

    it('leaves out symbols Alpaca does not know', async () => {
      respond({
        AAPL: {
          latestTrade: { t: '2026-11-05T20:59:58Z', p: 344.6 },
          prevDailyBar: bar('2026-11-04T05:00:00Z', 340),
        },
      });

      const quotes = await provider.getQuotes(['AAPL', 'ZZZZ']);

      expect(quotes.map((q) => q.symbol)).toEqual(['AAPL']);
    });

    it('makes no request for an empty list', async () => {
      await expect(provider.getQuotes([])).resolves.toEqual([]);
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  describe('getQuote', () => {
    it('fails clearly for a symbol Alpaca does not know', async () => {
      respond({});

      await expect(provider.getQuote('ZZZZ')).rejects.toThrow(
        new MarketDataUnavailableError('Alpaca has no data for ZZZZ'),
      );
    });
  });

  describe('getCandles', () => {
    it('asks for the newest bars and returns them oldest first', async () => {
      respond({
        bars: [
          bar('2026-11-05T20:59:00Z', 344.6),
          bar('2026-11-05T20:58:00Z', 344.62),
        ],
      });

      const candles = await provider.getCandles('AAPL', '1m', 2);

      const { url } = request();
      expect(url.pathname).toBe('/v2/stocks/AAPL/bars');
      expect(url.searchParams.get('timeframe')).toBe('1Min');
      expect(url.searchParams.get('limit')).toBe('2');
      expect(url.searchParams.get('sort')).toBe('desc');
      expect(url.searchParams.get('adjustment')).toBe('split');
      expect(candles.map((c) => c.time)).toEqual([
        Date.parse('2026-11-05T20:58:00Z') / 1000,
        Date.parse('2026-11-05T20:59:00Z') / 1000,
      ]);
      expect(candles[1]).toEqual({
        time: Date.parse('2026-11-05T20:59:00Z') / 1000,
        open: 344.6,
        high: 345.6,
        low: 343.6,
        close: 344.6,
        volume: 1000,
      });
    });

    it('labels daily bars with midnight UTC of their date', async () => {
      // Alpaca: midnight New York = 05:00 UTC in winter, 04:00 in summer
      respond({
        bars: [
          bar('2026-11-05T05:00:00Z', 344.6),
          bar('2026-10-30T04:00:00Z', 340),
        ],
      });

      const candles = await provider.getCandles('AAPL', '1D', 2);

      expect(request().url.searchParams.get('timeframe')).toBe('1Day');
      expect(candles.map((c) => c.time)).toEqual([
        Date.parse('2026-10-30T00:00:00Z') / 1000,
        Date.parse('2026-11-05T00:00:00Z') / 1000,
      ]);
    });

    it('returns no candles when Alpaca has none (bars: null)', async () => {
      respond({ bars: null, symbol: 'AAPL', next_page_token: null });

      await expect(provider.getCandles('AAPL', '1W', 10)).resolves.toEqual([]);
    });
  });

  describe('failures', () => {
    it('turns an HTTP error (e.g. 429 rate limit) into MarketDataUnavailableError', async () => {
      respond({ message: 'too many requests' }, 429);

      const error = await provider.getQuotes(['AAPL']).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(MarketDataUnavailableError);
      expect((error as Error).message).toContain('429');
      expect((error as Error).message).not.toContain('SECRET');
    });

    it('turns a network error into MarketDataUnavailableError', async () => {
      fetchFn.mockRejectedValueOnce(new TypeError('fetch failed'));

      await expect(provider.getCandles('AAPL', '1D', 10)).rejects.toThrow(
        MarketDataUnavailableError,
      );
    });
  });

  describe('barsStart', () => {
    const now = Date.parse('2026-11-06T12:00:00Z');
    const daysBack = (start: string) => (now - Date.parse(start)) / 86_400_000;

    it('reaches back far enough for the bars, across nights and weekends', () => {
      // 300 one-minute bars = ~1 trading day; must cover a long weekend
      expect(daysBack(barsStart('1m', 300, now))).toBeGreaterThan(4);
      // 300 daily bars = ~420 calendar days
      expect(daysBack(barsStart('1D', 300, now))).toBeGreaterThan(420);
      // 100 weekly bars = 700 days
      expect(daysBack(barsStart('1W', 100, now))).toBeGreaterThan(700);
    });
  });
});
