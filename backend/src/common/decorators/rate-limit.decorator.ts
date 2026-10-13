import { SetMetadata } from '@nestjs/common';

export type RateLimitOptions = {
  // Max requests per client IP...
  limit: number;
  // ...within this window
  windowMs: number;
};

export const RATE_LIMIT_KEY = 'rateLimit';

// Applies to every route without its own @RateLimit
export const DEFAULT_RATE_LIMIT: RateLimitOptions = {
  limit: 100,
  windowMs: 60_000,
};

/** Overrides the default limit for one route or a whole controller. */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

/** Turns rate limiting off, e.g. for health checks. */
export const SkipRateLimit = () => SetMetadata(RATE_LIMIT_KEY, false);
