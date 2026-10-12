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

  it('lists every problem at once', () => {
    expect(() => validateEnv({})).toThrow(
      /DATABASE_URL is required\n- JWT_SECRET is required/,
    );
  });
});
