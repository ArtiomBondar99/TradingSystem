import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const REQUEST_ID_HEADER = 'x-request-id';

// Accept a client-provided ID only if it is short and contains safe characters,
// so a malicious value can't pollute our logs.
const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Returns the request's ID, creating one if needed, and makes sure both the
 * request and the response carry it. Safe to call more than once per request:
 * the second call finds the valid ID set by the first and reuses it.
 * Shared by RequestIdMiddleware and the logger (genReqId).
 */
export function resolveRequestId(
  req: IncomingMessage,
  res: ServerResponse,
): string {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const requestId =
    typeof incoming === 'string' && VALID_REQUEST_ID.test(incoming)
      ? incoming
      : randomUUID();

  req.headers[REQUEST_ID_HEADER] = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  return requestId;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    resolveRequestId(req, res);
    next();
  }
}
