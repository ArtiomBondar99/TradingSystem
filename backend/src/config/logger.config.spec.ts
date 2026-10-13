import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { createLoggerOptions, REDACTED_PATHS } from './logger.config.js';

describe('createLoggerOptions', () => {
  const configFor = (environment: string) =>
    ({
      getOrThrow: jest.fn((key: string) =>
        key === 'app.environment' ? environment : 'info',
      ),
    }) as unknown as ConfigService;

  type PinoHttpOptions = {
    level: string;
    transport?: unknown;
    customProps: (req: unknown) => { userId?: string };
  };
  const pinoHttpOf = (environment: string) =>
    createLoggerOptions(configFor(environment))
      .pinoHttp as unknown as PinoHttpOptions;

  it('never logs the Authorization header, passwords or tokens', () => {
    expect(REDACTED_PATHS).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        '*.password',
        '*.accessToken',
      ]),
    );
  });

  it('is silent in tests and pretty-printed only in development', () => {
    expect(pinoHttpOf('test').level).toBe('silent');
    expect(pinoHttpOf('development').transport).toBeDefined();
    expect(pinoHttpOf('production').transport).toBeUndefined();
  });

  it('adds the authenticated userId to request logs', () => {
    const { customProps } = pinoHttpOf('production');

    expect(customProps({ user: { userId: 'user-1' } })).toEqual({
      userId: 'user-1',
    });
    expect(customProps({})).toEqual({ userId: undefined });
  });
});
