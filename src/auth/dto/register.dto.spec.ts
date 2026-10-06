import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { RegisterDto } from './register.dto.js';

describe('RegisterDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const validate = (body: unknown) =>
    pipe.transform(body, { type: 'body', metatype: RegisterDto });

  it('accepts a valid email and password', async () => {
    const dto = await validate({
      email: 'trader@example.com',
      password: 'StrongPass1',
    });

    expect(dto).toBeInstanceOf(RegisterDto);
  });

  it('normalizes the email to trimmed lowercase', async () => {
    const dto = await validate({
      email: '  Trader@Example.COM ',
      password: 'StrongPass1',
    });

    expect(dto.email).toBe('trader@example.com');
  });

  it.each([
    ['an invalid email', { email: 'not-an-email', password: 'StrongPass1' }],
    ['a short password', { email: 'trader@example.com', password: 'short' }],
    ['a missing password', { email: 'trader@example.com' }],
    [
      'an unknown field',
      { email: 'trader@example.com', password: 'StrongPass1', balance: 1e9 },
    ],
  ])('rejects %s', async (_case, body) => {
    await expect(validate(body)).rejects.toBeInstanceOf(BadRequestException);
  });
});
