import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';
import { Prisma } from '../../generated/prisma/client.js';
import { resolveRequestId } from '../middleware/request-id.middleware.js';

// The one shape every error response has
export type ErrorResponse = {
  statusCode: number;
  error: string;
  message: string;
  // Only for validation errors: one entry per invalid field
  errors?: string[];
  path: string;
  // Same as the X-Request-Id header: quote it to find this request in the logs
  requestId: string;
  timestamp: string;
};

type Resolved = {
  status: number;
  message: string;
  errors?: string[];
  // A body the handler built on purpose (e.g. /health's 503), sent unchanged
  custom?: object;
};

/**
 * Catches EVERY exception, so clients always get the same error format and
 * never a stack trace. Unexpected errors (5xx) are logged with their stack;
 * 4xx are the client's fault and pino-http already logs them as warnings.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    // Global filters also catch errors in WebSocket handlers, where there is
    // no HTTP response to write: answer on the socket instead
    if (host.getType() !== 'http') {
      this.catchWebSocket(exception, host);
      return;
    }

    const { httpAdapter } = this.adapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Usually set by RequestIdMiddleware already. But some errors (e.g.
    // malformed JSON from the body parser) happen before it runs.
    const requestId = resolveRequestId(request, response);

    const resolved = this.resolve(exception);

    if (resolved.status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponse | object = resolved.custom ?? {
      statusCode: resolved.status,
      error: STATUS_CODES[resolved.status] ?? 'Error',
      message: resolved.message,
      ...(resolved.errors && { errors: resolved.errors }),
      path: request.url,
      requestId,
      timestamp: new Date().toISOString(),
    };

    httpAdapter.reply(response, body, resolved.status);
  }

  // Same message, as an "error" event on the socket, never a stack trace
  private catchWebSocket(exception: unknown, host: ArgumentsHost): void {
    const resolved = this.resolve(exception);
    if (resolved.status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const client = host
      .switchToWs()
      .getClient<{ send?: (data: string) => void }>();
    client.send?.(
      JSON.stringify({ event: 'error', data: { message: resolved.message } }),
    );
  }

  private resolve(exception: unknown): Resolved {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrismaError(exception);
    }

    // A bug or an outage: never leak its details to the client
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  private fromHttpException(exception: HttpException): Resolved {
    const status = exception.getStatus();
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return { status, message: response };
    }

    if (!('message' in response)) {
      return { status, message: exception.message, custom: response };
    }

    const { message } = response as { message: string | string[] };

    // ValidationPipe sends one message per invalid field
    if (Array.isArray(message)) {
      return { status, message: 'Validation failed', errors: message };
    }

    return { status, message };
  }

  // A database rule caught something the code didn't: map it to a 4xx
  private fromPrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
  ): Resolved {
    switch (exception.code) {
      case 'P2002': // unique constraint
        return {
          status: HttpStatus.CONFLICT,
          message: 'Resource already exists',
        };
      case 'P2025': // record to update/delete not found
        return { status: HttpStatus.NOT_FOUND, message: 'Resource not found' };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
        };
    }
  }
}
