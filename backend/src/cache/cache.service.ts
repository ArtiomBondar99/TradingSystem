import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * A thin JSON cache over Redis. It FAILS OPEN: if Redis is down, reads miss
 * and writes are skipped, so the app keeps working straight from Postgres.
 * The cache only makes things faster; it must never make them break.
 *
 * Values are stored as JSON, so a Date comes back as an ISO string. Only cache
 * what you send to clients as-is (response DTOs), never entities with Decimals.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private connected = false;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    // Log changes of state, not every failed reconnect attempt (every ~2s).
    // A lost connection may show up as 'error' or only as 'close'.
    redis.on('ready', () => {
      this.connected = true;
      this.logger.log('Redis connected');
    });
    redis.on('error', (error: Error) => this.markDown(error.message));
    redis.on('close', () => this.markDown('connection closed'));
  }

  private markDown(reason: string): void {
    if (this.connected) {
      this.logger.warn(
        `Redis unavailable, serving from the database: ${reason}`,
      );
    }
    this.connected = false;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value === null ? null : (JSON.parse(value) as T);
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      // EX = expire after N seconds, so stale data can't live forever
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // Fail open: not caching is fine
    }
  }

  async del(...keys: string[]): Promise<void> {
    try {
      await this.redis.del(...keys);
    } catch {
      // Fail open: the TTL will expire the key anyway
    }
  }

  /**
   * Cache-aside: return the cached value, or load it, cache it and return it.
   * Errors from load() (e.g. a 404) are thrown as usual and not cached.
   */
  async remember<T>(
    key: string,
    ttlSeconds: number,
    load: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await load();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async onModuleDestroy(): Promise<void> {
    // QUIT waits for pending replies; if Redis is unreachable, just drop it
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
