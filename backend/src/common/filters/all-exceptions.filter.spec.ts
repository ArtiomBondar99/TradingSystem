import { jest } from '@jest/globals';
import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '../../generated/prisma/client.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

describe('AllExceptionsFilter', () => {
  const reply = jest.fn();
  const adapterHost = { httpAdapter: { reply } } as unknown as HttpAdapterHost;
  const filter = new AllExceptionsFilter(adapterHost);
  const response = { setHeader: jest.fn() };

  const hostFor = (headers: Record<string, string>) =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ url: '/stocks/ZZZZ', headers }),
        getResponse: () => response,
      }),
    }) as unknown as ArgumentsHost;

  // A request that already went through RequestIdMiddleware
  const host = hostFor({ 'x-request-id': 'req-123' });

  // The body and status the filter sent
  const sent = () => {
    const [, body, status] = reply.mock.calls[0];
    return { body: body as Record<string, unknown>, status };
  };

  const prismaError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('db error', {
      code,
      clientVersion: 'test',
    });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('formats an HttpException with path, requestId and timestamp', () => {
    filter.catch(new NotFoundException('Stock ZZZZ not found'), host);

    const { body, status } = sent();
    expect(status).toBe(404);
    expect(body).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'Stock ZZZZ not found',
      path: '/stocks/ZZZZ',
      requestId: 'req-123',
      timestamp: expect.any(String),
    });
  });

  it('turns validation messages into a single message plus an errors list', () => {
    filter.catch(
      new BadRequestException([
        'quantity must be at least 1',
        'side must be BUY or SELL',
      ]),
      host,
    );

    const { body } = sent();
    expect(body.message).toBe('Validation failed');
    expect(body.errors).toEqual([
      'quantity must be at least 1',
      'side must be BUY or SELL',
    ]);
  });

  it('hides the details of an unexpected error behind a 500', () => {
    filter.catch(new Error('connection string with a password in it'), host);

    const { body, status } = sent();
    expect(status).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('password');
  });

  it('logs the stack of a 500, so it can be debugged', () => {
    filter.catch(new Error('boom'), host);

    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining('boom'),
    );
  });

  it('does not log a 4xx as an error', () => {
    filter.catch(new NotFoundException(), host);

    expect(Logger.prototype.error).not.toHaveBeenCalled();
  });

  it('maps a Prisma unique violation to 409', () => {
    filter.catch(prismaError('P2002'), host);

    expect(sent().status).toBe(409);
  });

  it('maps a Prisma "record not found" to 404', () => {
    filter.catch(prismaError('P2025'), host);

    expect(sent().status).toBe(404);
  });

  it('creates a requestId when the error happened before the middleware ran', () => {
    // e.g. malformed JSON: the body parser fails before RequestIdMiddleware
    filter.catch(
      new BadRequestException('Unexpected end of JSON input'),
      hostFor({}),
    );

    const { body } = sent();
    expect(body.requestId).toEqual(expect.any(String));
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-request-id',
      body.requestId,
    );
  });

  it('keeps a custom body built on purpose, like the /health 503', () => {
    const custom = { status: 'error', database: 'down' };
    filter.catch(new ServiceUnavailableException(custom), host);

    const { body, status } = sent();
    expect(status).toBe(503);
    expect(body).toEqual(custom);
  });

  it('answers a WebSocket error on the socket, not as an HTTP reply', () => {
    const client = { send: jest.fn() };
    const wsHost = {
      getType: () => 'ws',
      switchToWs: () => ({ getClient: () => client }),
    } as unknown as ArgumentsHost;

    filter.catch(new BadRequestException('symbols must be an array'), wsHost);

    expect(reply).not.toHaveBeenCalled();
    expect(JSON.parse(client.send.mock.calls[0][0] as string)).toEqual({
      event: 'error',
      data: { message: 'symbols must be an array' },
    });
  });
});
