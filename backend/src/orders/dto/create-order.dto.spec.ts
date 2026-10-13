import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateOrderDto } from './create-order.dto.js';

describe('CreateOrderDto', () => {
  // Same options as the global pipe in AppModule
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const validate = (body: unknown) =>
    pipe.transform(body, { type: 'body', metatype: CreateOrderDto });

  const valid = { symbol: 'AAPL', side: 'BUY', quantity: 10 };

  it('accepts a valid market order and defaults type to MARKET', async () => {
    const dto = await validate(valid);

    expect(dto).toBeInstanceOf(CreateOrderDto);
    expect(dto.type).toBe('MARKET');
  });

  it('normalizes the symbol to uppercase', async () => {
    const dto = await validate({ ...valid, symbol: ' aapl ' });

    expect(dto.symbol).toBe('AAPL');
  });

  it.each([
    ['a zero quantity', { ...valid, quantity: 0 }],
    ['a negative quantity', { ...valid, quantity: -5 }],
    ['a fractional quantity', { ...valid, quantity: 1.5 }],
    ['a quantity sent as a string', { ...valid, quantity: '10' }],
    ['an absurd quantity', { ...valid, quantity: 10_000_000 }],
    ['an unknown side', { ...valid, side: 'HOLD' }],
    ['a lowercase side', { ...valid, side: 'buy' }],
    ['an unsupported type', { ...valid, type: 'LIMIT' }],
    ['an invalid symbol', { ...valid, symbol: 'AAPL1' }],
    ['a missing symbol', { side: 'BUY', quantity: 10 }],
    ['a client-chosen price', { ...valid, price: 0.01 }],
    ['a client-chosen status', { ...valid, status: 'FILLED' }],
  ])('rejects %s', async (_case, body) => {
    await expect(validate(body)).rejects.toBeInstanceOf(BadRequestException);
  });
});
