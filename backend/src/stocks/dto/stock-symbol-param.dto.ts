import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';

// Validates the :symbol route parameter. "aapl" and " AAPL " both become "AAPL".
export class StockSymbolParamDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{1,10}$/, {
    message: 'symbol must be 1-10 letters, e.g. AAPL',
  })
  symbol: string;
}
