import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

/**
 * Reads the Idempotency-Key header. Unlike @Headers(), a custom decorator
 * accepts pipes, so the value can be validated:
 *   @IdempotencyKey(new ParseUUIDPipe({ optional: true })) key?: string
 */
export const IdempotencyKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.header(IDEMPOTENCY_KEY_HEADER);
  },
);
