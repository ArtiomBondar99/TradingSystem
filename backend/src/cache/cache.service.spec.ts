import { jest } from '@jest/globals';
import type { Redis } from 'ioredis';
import { CacheService } from './cache.service.js';

describe('CacheService', () => {
  const redis = {
    on: jest.fn(),
    get: jest.fn<(key: string) => Promise<string | null>>(),
    set: jest.fn<(...args: unknown[]) => Promise<'OK'>>(),
    del: jest.fn<(...keys: string[]) => Promise<number>>(),
  };
  let cache: CacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    cache = new CacheService(redis as unknown as Redis);
  });

  it('returns the cached JSON value on a hit, without loading', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ symbol: 'AAPL' }));
    const load = jest.fn<() => Promise<object>>();

    const value = await cache.remember('stocks:AAPL', 30, load);

    expect(value).toEqual({ symbol: 'AAPL' });
    expect(load).not.toHaveBeenCalled();
  });

  it('loads and stores the value with a TTL on a miss', async () => {
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue('OK');

    const value = await cache.remember('stocks:AAPL', 30, async () => ({
      symbol: 'AAPL',
    }));

    expect(value).toEqual({ symbol: 'AAPL' });
    expect(redis.set).toHaveBeenCalledWith(
      'stocks:AAPL',
      '{"symbol":"AAPL"}',
      'EX',
      30,
    );
  });

  it('fails open: when Redis is down, it still returns the loaded value', async () => {
    redis.get.mockRejectedValue(new Error('ECONNREFUSED'));
    redis.set.mockRejectedValue(new Error('ECONNREFUSED'));

    const value = await cache.remember('stocks:AAPL', 30, async () => ({
      symbol: 'AAPL',
    }));

    expect(value).toEqual({ symbol: 'AAPL' });
  });

  it('does not cache a failed load (e.g. a 404)', async () => {
    redis.get.mockResolvedValue(null);

    await expect(
      cache.remember('stocks:NOPE', 30, () =>
        Promise.reject(new Error('not found')),
      ),
    ).rejects.toThrow('not found');
    expect(redis.set).not.toHaveBeenCalled();
  });
});
