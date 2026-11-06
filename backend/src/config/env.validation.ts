// Runs once at startup (ConfigModule's validate). A missing or weak secret
// stops the app right away with a clear message, instead of starting with
// a broken or insecure setup and failing on the first request.

const MIN_JWT_SECRET_LENGTH = 32;

export function validateEnv(
  env: Record<string, unknown>,
): Record<string, unknown> {
  const errors: string[] = [];

  for (const name of ['DATABASE_URL', 'JWT_SECRET']) {
    if (typeof env[name] !== 'string' || env[name] === '') {
      errors.push(`${name} is required`);
    }
  }

  const secret = env.JWT_SECRET;
  if (typeof secret === 'string' && secret.length < MIN_JWT_SECRET_LENGTH) {
    // A short secret can be brute-forced offline from any token we issue
    errors.push(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters (got ${secret.length})`,
    );
  }

  const provider = env.MARKET_DATA_PROVIDER ?? 'simulated';
  if (provider !== 'simulated' && provider !== 'alpaca') {
    errors.push(
      `MARKET_DATA_PROVIDER must be "simulated" or "alpaca" (got ${JSON.stringify(provider)})`,
    );
  }
  if (provider === 'alpaca') {
    // Without keys every price request would fail with 401: stop at startup
    for (const name of ['ALPACA_API_KEY_ID', 'ALPACA_API_SECRET_KEY']) {
      if (typeof env[name] !== 'string' || env[name] === '') {
        errors.push(`${name} is required when MARKET_DATA_PROVIDER=alpaca`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment:\n- ${errors.join('\n- ')}`);
  }

  return env;
}
