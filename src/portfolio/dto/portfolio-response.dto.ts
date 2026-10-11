// All money fields are strings such as "1900.00", never JS numbers

export class PositionResponseDto {
  symbol: string;
  name: string;
  quantity: number;
  averagePrice: string;
  currentPrice: string;
  // currentPrice * quantity: what the shares are worth right now
  marketValue: string;
  // marketValue - averagePrice * quantity: profit if you sold right now
  unrealizedPnL: string;
  unrealizedPnLPercent: string;
}

export class PortfolioResponseDto {
  cashBalance: string;
  positionsValue: string;
  // cashBalance + positionsValue
  totalValue: string;
  unrealizedPnL: string;
  positions: PositionResponseDto[];
}
