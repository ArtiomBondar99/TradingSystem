import { validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  const valid = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_SECRET: 'x'.repeat(32),
  };

  it('accepts a complete environment', () => {
    expect(validateEnv(valid)).toBe(valid);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => validateEnv({ ...valid, DATABASE_URL: undefined })).toThrow(
      'DATABASE_URL is required',
    );
  });

  it('rejects a missing JWT_SECRET', () => {
    expect(() => validateEnv({ ...valid, JWT_SECRET: '' })).toThrow(
      'JWT_SECRET is required',
    );
  });

  it('rejects a JWT_SECRET shorter than 32 characters', () => {
    expect(() => validateEnv({ ...valid, JWT_SECRET: 'secret' })).toThrow(
      'JWT_SECRET must be at least 32 characters (got 6)',
    );
  });

  describe('MARKET_DATA_PROVIDER', () => {
    it('accepts alpaca when both keys are set', () => {
      const env = {
        ...valid,
        MARKET_DATA_PROVIDER: 'alpaca',
        ALPACA_API_KEY_ID: 'key',
        ALPACA_API_SECRET_KEY: 'secret',
      };
      expect(validateEnv(env)).toBe(env);
    });

    it('requires the Alpaca keys when the provider is alpaca', () => {
      expect(() =>
        validateEnv({ ...valid, MARKET_DATA_PROVIDER: 'alpaca' }),
      ).toThrow(
        /ALPACA_API_KEY_ID is required when MARKET_DATA_PROVIDER=alpaca\n- ALPACA_API_SECRET_KEY is required/,
      );
    });

    it('does not need Alpaca keys for the simulated provider', () => {
      expect(() =>
        validateEnv({ ...valid, MARKET_DATA_PROVIDER: 'simulated' }),
      ).not.toThrow();
    });

    it('rejects an unknown provider (e.g. a typo)', () => {
      expect(() =>
        validateEnv({ ...valid, MARKET_DATA_PROVIDER: 'alpacca' }),
      ).toThrow('MARKET_DATA_PROVIDER must be "simulated" or "alpaca"');
    });
  });

  describe('SMTP_URL and FRONTEND_URL', () => {
    it('are optional in development (Mailpit, Vite on localhost)', () => {
      expect(() =>
        validateEnv({ ...valid, NODE_ENV: 'development' }),
      ).not.toThrow();
    });

    it('are required in production', () => {
      expect(() => validateEnv({ ...valid, NODE_ENV: 'production' })).toThrow(
        /SMTP_URL is required when NODE_ENV=production\n- FRONTEND_URL is required/,
      );
    });

    it('accept production with both set', () => {
      const env = {
        ...valid,
        NODE_ENV: 'production',
        SMTP_URL: 'smtps://user:pass@smtp.example.com:465',
        FRONTEND_URL: 'https://trade.example.com',
      };
      expect(validateEnv(env)).toBe(env);
    });
  });

  it('lists every problem at once', () => {
    expect(() => validateEnv({})).toThrow(
      /DATABASE_URL is required\n- JWT_SECRET is required/,
    );
  });
});
