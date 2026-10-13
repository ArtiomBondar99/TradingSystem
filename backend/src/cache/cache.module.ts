import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { CacheService, REDIS_CLIENT } from './cache.service.js';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis(config.getOrThrow<string>('redis.url'), {
          // While disconnected, fail commands at once instead of queueing
          // them: a request should fall back to Postgres, not hang
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
        }),
    },
    CacheService,
  ],
  // REDIS_CLIENT too: RateLimitGuard counts requests in Redis directly
  exports: [CacheService, REDIS_CLIENT],
})
export class CacheModule {}
