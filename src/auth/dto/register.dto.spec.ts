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

  const valid = {
    email: 'trader@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    password: 'StrongPass1',
  };

  it('accepts a valid body', async () => {
    const dto = await validate(valid);

    expect(dto).toBeInstanceOf(RegisterDto);
  });

  it('normalizes the email to trimmed lowercase', async () => {
    const dto = await validate({ ...valid, email: '  Trader@Example.COM ' });

    expect(dto.email).toBe('trader@example.com');
  });

  it('trims the names', async () => {
    const dto = await validate({
      ...valid,
      firstName: '  Ada ',
      lastName: ' Lovelace  ',
    });

    expect(dto.firstName).toBe('Ada');
    expect(dto.lastName).toBe('Lovelace');
  });

  it.each([
    ['an invalid email', { ...valid, email: 'not-an-email' }],
    ['a short password', { ...valid, password: 'short' }],
    ['a missing password', { ...valid, password: undefined }],
    ['a missing first name', { ...valid, firstName: undefined }],
    ['a whitespace-only last name', { ...valid, lastName: '   ' }],
    ['a first name over 50 chars', { ...valid, firstName: 'a'.repeat(51) }],
    ['an unknown field', { ...valid, balance: 1e9 }],
  ])('rejects %s', async (_case, body) => {
    await expect(validate(body)).rejects.toBeInstanceOf(BadRequestException);
  });
});
