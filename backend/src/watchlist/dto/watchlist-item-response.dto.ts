export class WatchlistItemResponseDto {
  symbol: string;
  name: string;
  // The price orders execute at, as a string such as "190.00"
  currentPrice: string;
  // Today's move from the previous close, from the live feed. null until
  // the first price sync after a restart (and in tests, where it's off).
  change: number | null;
  changePercent: number | null;
  addedAt: Date;
}
