// POST /orders/preview: what an order would do if sent now. Estimates only:
// the real fill re-checks everything under the wallet lock.
// Money as strings ("190.00"), like every other response.
export class OrderPreviewDto {
  symbol: string;
  // The last price, before slippage
  marketPrice: string;
  marketOpen: boolean;
  // false: it would wait as PENDING (a LIMIT/STOP not reached, or market closed)
  executesNow: boolean;
  // Why it would be REJECTED (MARKET_CLOSED, INSUFFICIENT_FUNDS,
  // INSUFFICIENT_SHARES), or null if it would be accepted
  blockedReason: string | null;
  // Fill price incl. slippage (for a waiting LIMIT: its limit, the worst case)
  estimatedPrice: string;
  // estimatedPrice * quantity
  estimatedAmount: string;
  estimatedFee: string;
  // BUY: amount + fee leaves the wallet. SELL: amount - fee comes in.
  estimatedTotal: string;
  // Cash not reserved by open BUY orders
  buyingPower: string;
  // Shares of this stock not reserved by open SELL orders
  sellableShares: number;
}
