import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { StockSymbolParamDto } from './stock-symbol-param.dto.js';

describe('StockSymbolParamDto', () => {
  const pipe = new ValidationPipe({ transform: true });

  const validate = (symbol: unknown) =>
    pipe.transform(
      { symbol },
      { type: 'param', metatype: StockSymbolParamDto },
    );

  it('uppercases and trims the symbol', async () => {
    const dto = await validate(' aapl ');

    expect(dto.symbol).toBe('AAPL');
  });

  it.each([
    ['digits', 'AAPL1'],
    ['symbols', 'AA$L'],
    ['too long', 'ABCDEFGHIJK'],
    ['SQL-looking input', "AAPL'; DROP TABLE stocks;--"],
  ])('rejects %s', async (_case, symbol) => {
    await expect(validate(symbol)).rejects.toBeInstanceOf(BadRequestException);
  });
});
