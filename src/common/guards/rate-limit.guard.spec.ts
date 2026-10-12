import { jest } from '@jest/globals';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Redis } from 'ioredis';
import {
  DEFAULT_RATE_LIMIT,
  type RateLimitOptions,
} from '../decorators/rate-limit.decorator.js';
import { RateLimitGuard } from './rate-limit.guard.js';

describe('RateLimitGuard', () => {
  // A fake MULTI: each test decides what INCR and PTTL return
  let hits = 1;
  let msLeft = 60_000;
  let redisDown = false;
  const multi = {
    incr: jest.fn(() => multi),
    pexpire: jest.fn(() => multi),
    pttl: jest.fn(() => multi),
    exec: jest.fn(async () => {
      if (redisDown) throw new Error('ECONNREFUSED');
      return [
        [null, hits],
        [null, 1],
        [null, msLeft],
      ];
    }),
  };
  const redis = { multi: () => multi } as unknown as Redis;

  const response = { setHeader: jest.fn() };
  class AuthController {}
  function login() {}
  const context = {
    getHandler: () => login,
    getClass: () => AuthController,
    switchToHttp: () => ({
      getRequest: () => ({ ip: '1.2.3.4' }),
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;

  const guardWith = (
    options: RateLimitOptions | false | undefined,
    enabled = true,
  ) => {
    const reflector = {
      getAllAndOverride: () => options,
    } as unknown as Reflector;
    const config = {
      getOrThrow: () => enabled,
    } as unknown as ConfigService;
    return new RateLimitGuard(reflector, redis, config);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    hits = 1;
    msLeft = 60_000;
    redisDown = false;
  });

  it('allows requests up to the limit and reports what is left', async () => {
    hits = 5;

    await expect(
      guardWith({ limit: 5, windowMs: 60_000 }).canActivate(context),
    ).resolves.toBe(true);
    expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
  });

  it('blocks the request over the limit with 429 and Retry-After', async () => {
    hits = 6;
    msLeft = 41_500;

    const error = await guardWith({ limit: 5, windowMs: 60_000 })
      .canActivate(context)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', 42);
  });

  it('counts per route and per IP', async () => {
    await guardWith(undefined).canActivate(context);

    expect(multi.incr).toHaveBeenCalledWith(
      'rate-limit:AuthController.login:1.2.3.4',
    );
  });

  it('starts the window only on the first hit (PEXPIRE ... NX)', async () => {
    await guardWith({ limit: 5, windowMs: 60_000 }).canActivate(context);

    expect(multi.pexpire).toHaveBeenCalledWith(
      expect.any(String),
      60_000,
      'NX',
    );
  });

  it('uses the default limit on routes without @RateLimit', async () => {
    hits = DEFAULT_RATE_LIMIT.limit + 1;

    await expect(guardWith(undefined).canActivate(context)).rejects.toThrow(
      HttpException,
    );
  });

  it('skips routes marked @SkipRateLimit', async () => {
    await expect(guardWith(false).canActivate(context)).resolves.toBe(true);
    expect(multi.exec).not.toHaveBeenCalled();
  });

  it('does nothing when rate limiting is disabled (tests)', async () => {
    await expect(
      guardWith({ limit: 5, windowMs: 60_000 }, false).canActivate(context),
    ).resolves.toBe(true);
    expect(multi.exec).not.toHaveBeenCalled();
  });

  it('fails open when Redis is down', async () => {
    redisDown = true;
    hits = 1_000;

    await expect(
      guardWith({ limit: 5, windowMs: 60_000 }).canActivate(context),
    ).resolves.toBe(true);
  });
});
