import { describe, expect, it } from 'vitest';
import {
  formatMoney,
  formatPercent,
  formatSignedMoney,
  pnlColor,
} from './format';

describe('format', () => {
  it('formats the exact money strings the API sends', () => {
    expect(formatMoney('100000.00')).toBe('$100,000.00');
    expect(formatMoney('0.5')).toBe('$0.50');
  });

  it('signs P&L, except zero', () => {
    expect(formatSignedMoney('12.50')).toBe('+$12.50');
    expect(formatSignedMoney('-3.20')).toBe('-$3.20');
    expect(formatSignedMoney('0.00')).toBe('$0.00');
  });

  it('signs a positive percent and keeps two decimals', () => {
    expect(formatPercent('5.2')).toBe('+5.20%');
    expect(formatPercent('-1.416')).toBe('-1.42%');
    expect(formatPercent('0')).toBe('0.00%');
  });

  it('colors profit green, loss red, zero grey', () => {
    expect(pnlColor('0.01')).toBe('text-up');
    expect(pnlColor('-0.01')).toBe('text-down');
    expect(pnlColor('0.00')).toBe('text-muted');
  });
});
