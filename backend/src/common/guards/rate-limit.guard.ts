import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../cache/cache.service.js';
import {
  DEFAULT_RATE_LIMIT,
  RATE_LIMIT_KEY,
  type RateLimitOptions,
} from '../decorators/rate-limit.decorator.js';

/**
 * Fixed-window rate limiting per client IP and route, counted in Redis.
 *
 * Why Redis and not memory: with several API instances behind a load
 * balancer, in-memory counters let an attacker get N times the limit.
 * One shared counter in Redis enforces the real limit across all of them.
 *
 * Fails open: if Redis is down, requests are allowed. Losing rate limiting
 * for a while is better than taking the whole API down with Redis.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly enabled: boolean;

  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    config: ConfigService,
  ) {
    this.enabled = config.getOrThrow<boolean>('rateLimit.enabled');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Global guards also run for WebSocket messages, which have no HTTP
    // request or IP header here. They arrive on one already-open connection;
    // the gateway bounds them itself (symbols per connection).
    if (context.getType() !== 'http') {
      return true;
    }

    // The method's decorator wins over the controller's
    const options = this.reflector.getAllAndOverride<
      RateLimitOptions | false | undefined
    >(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]);

    if (!this.enabled || options === false) {
      return true;
    }
    const { limit, windowMs } = options ?? DEFAULT_RATE_LIMIT;

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const route = `${context.getClass().name}.${context.getHandler().name}`;
    const key = `rate-limit:${route}:${request.ip}`;

    const counter = await this.count(key, windowMs);
    if (!counter) {
      return true; // Redis unavailable: fail open
    }

    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader(
      'X-RateLimit-Remaining',
      Math.max(0, limit - counter.hits),
    );

    if (counter.hits > limit) {
      const retryAfter = Math.ceil(counter.msLeft / 1000);
      response.setHeader('Retry-After', retryAfter);
      throw new HttpException(
        `Too many requests, try again in ${retryAfter} seconds`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  // One round trip, atomic (MULTI): +1 to the counter, start the window's
  // clock only on the first hit (NX), and read how long the window has left
  private async count(
    key: string,
    windowMs: number,
  ): Promise<{ hits: number; msLeft: number } | null> {
    try {
      const results = await this.redis
        .multi()
        .incr(key)
        .pexpire(key, windowMs, 'NX')
        .pttl(key)
        .exec();
      if (!results) {
        return null;
      }
      const [[, hits], , [, msLeft]] = results as [
        [Error | null, number],
        unknown,
        [Error | null, number],
      ];
      return { hits, msLeft };
    } catch {
      return null;
    }
  }
}
