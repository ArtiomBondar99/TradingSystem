import { RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import { stdTimeFunctions } from 'pino';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { resolveRequestId } from '../common/middleware/request-id.middleware.js';

type RequestWithUser = IncomingMessage & { user?: AuthenticatedUser };

// Never let secrets reach the logs, even if someone logs a whole object by mistake
export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'password',
  '*.password',
  'passwordHash',
  '*.passwordHash',
  'accessToken',
  '*.accessToken',
];

export function createLoggerOptions(config: ConfigService): Params {
  const environment = config.getOrThrow<string>('app.environment');

  return {
    pinoHttp: {
      // Silent in tests so test output stays readable
      level:
        environment === 'test'
          ? 'silent'
          : config.getOrThrow<string>('app.logLevel'),

      timestamp: stdTimeFunctions.isoTime,

      // Same ID as the X-Request-Id response header
      genReqId: (req: IncomingMessage, res: ServerResponse) =>
        resolveRequestId(req, res),

      // Attached to every log line of the request; userId exists after JwtAuthGuard ran
      customProps: (req: IncomingMessage) => ({
        userId: (req as RequestWithUser).user?.userId,
      }),

      // 5xx = error, 4xx = warn, everything else = info
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },

      // Log only what helps debugging, not every header
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },

      redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },

      // Human-readable colored lines locally; raw JSON everywhere else
      transport:
        environment === 'development'
          ? {
              target: 'pino-pretty',
              options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' },
            }
          : undefined,
    },
    // Docker and load balancers call /health every few seconds; don't flood the logs
    exclude: [{ method: RequestMethod.GET, path: 'health' }],
  };
}
