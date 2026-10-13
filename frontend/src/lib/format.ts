// Display helpers. The backend sends money as exact strings ("1900.00") and
// does all the math with Decimal. Number() here is only for formatting, never
// for calculating, so float rounding can't change a balance.

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const signedUsd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  signDisplay: 'exceptZero',
});

// "100000.00" -> "$100,000.00"
export function formatMoney(value: string): string {
  return usd.format(Number(value));
}

// For P&L: "-12.50" -> "-$12.50", "12.50" -> "+$12.50"
export function formatSignedMoney(value: string): string {
  return signedUsd.format(Number(value));
}

// "5.26" -> "+5.26%"
export function formatPercent(value: string): string {
  const number = Number(value);
  return `${number > 0 ? '+' : ''}${number.toFixed(2)}%`;
}

// Green for profit, red for loss, grey for zero
export function pnlColor(value: string): string {
  const number = Number(value);
  if (number > 0) return 'text-up';
  if (number < 0) return 'text-down';
  return 'text-muted';
}
