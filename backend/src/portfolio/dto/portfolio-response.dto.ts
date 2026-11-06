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
  // marketValue / the portfolio's totalValue * 100: its share of everything
  allocationPercent: string;
}

export class PortfolioResponseDto {
  cashBalance: string;
  // cashBalance / totalValue * 100. With the positions' allocationPercent,
  // the parts of the allocation chart (they add up to ~100, after rounding)
  cashPercent: string;
  positionsValue: string;
  // cashBalance + positionsValue
  totalValue: string;
  // Paper profit/loss of the positions you still hold
  unrealizedPnL: string;
  // Profit/loss already locked in by your sales (after their fees)
  realizedPnL: string;
  positions: PositionResponseDto[];
}
