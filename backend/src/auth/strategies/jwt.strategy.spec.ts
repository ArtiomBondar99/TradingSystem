import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy.js';

describe('JwtStrategy', () => {
  const config = {
    getOrThrow: jest.fn<() => string>().mockReturnValue('test-secret'),
  } as unknown as ConfigService;

  const strategy = new JwtStrategy(config);

  it('maps the token payload to the authenticated user', () => {
    const user = strategy.validate({
      sub: 'user-1',
      email: 'trader@example.com',
    });

    expect(user).toEqual({ userId: 'user-1', email: 'trader@example.com' });
  });
});
