import { Prisma } from '../generated/prisma/client.js';
import {
  commission,
  fillPrice,
  isTriggered,
  reservedCash,
  type ExecutionRules,
} from './execution-rules.js';

const D = (value: string | number) => new Prisma.Decimal(value);

const REAL: ExecutionRules = {
  feesEnabled: true,
  slippageBps: 5,
  enforceMarketHours: true,
};
const FREE: ExecutionRules = {
  feesEnabled: false,
  slippageBps: 0,
  enforceMarketHours: false,
};

describe('execution rules', () => {
  describe('commission ($0.005/share, min $1, max 1%)', () => {
    it('charges per share on a large order', () => {
      // 1000 * 0.005 = 5.00
      expect(commission(REAL, 1000, D('190000')).toFixed(2)).toBe('5.00');
    });

    it('charges at least $1', () => {
      // 10 * 0.005 = 0.05 -> minimum 1.00
      expect(commission(REAL, 10, D('1900')).toFixed(2)).toBe('1.00');
    });

    it('never charges more than 1% of the trade', () => {
      // 1 share of a $20 stock: min $1 would be 5%, so 1% = 0.20
      expect(commission(REAL, 1, D('20')).toFixed(2)).toBe('0.20');
    });

    it('rounds up to whole cents', () => {
      // 1001 * 0.005 = 5.005 -> 5.01
      expect(commission(REAL, 1001, D('190190')).toFixed(2)).toBe('5.01');
    });

    it('is zero when fees are off', () => {
      expect(commission(FREE, 1000, D('190000')).toFixed(2)).toBe('0.00');
    });
  });

  describe('fillPrice (5 bps slippage)', () => {
    it('a BUY pays a little more, rounded up to the cent', () => {
      // 190 * 1.0005 = 190.095 -> 190.10
      expect(fillPrice(REAL, 'BUY', D('190'), null).toFixed(2)).toBe('190.10');
    });

    it('a SELL gets a little less, rounded down to the cent', () => {
      // 190 * 0.9995 = 189.905 -> 189.90
      expect(fillPrice(REAL, 'SELL', D('190'), null).toFixed(2)).toBe('189.90');
    });

    it('a LIMIT fill is never worse than the limit', () => {
      // Market 190, slipped 190.10, but the user said "at most 190.05"
      expect(fillPrice(REAL, 'BUY', D('190'), D('190.05')).toFixed(2)).toBe(
        '190.05',
      );
      expect(fillPrice(REAL, 'SELL', D('190'), D('189.95')).toFixed(2)).toBe(
        '189.95',
      );
    });

    it('is the market price when slippage is off', () => {
      expect(fillPrice(FREE, 'BUY', D('190'), null).toFixed(2)).toBe('190.00');
    });
  });

  describe('isTriggered', () => {
    const order = (
      side: 'BUY' | 'SELL',
      type: 'LIMIT' | 'STOP',
      price: string,
    ) => ({
      side,
      type,
      limitPrice: type === 'LIMIT' ? D(price) : null,
      stopPrice: type === 'STOP' ? D(price) : null,
    });

    it('LIMIT: BUY at or below, SELL at or above', () => {
      expect(isTriggered(order('BUY', 'LIMIT', '190'), D('190'))).toBe(true);
      expect(isTriggered(order('BUY', 'LIMIT', '190'), D('190.01'))).toBe(
        false,
      );
      expect(isTriggered(order('SELL', 'LIMIT', '190'), D('190'))).toBe(true);
      expect(isTriggered(order('SELL', 'LIMIT', '190'), D('189.99'))).toBe(
        false,
      );
    });

    it('STOP: BUY at or above (breakout), SELL at or below (stop-loss)', () => {
      expect(isTriggered(order('BUY', 'STOP', '200'), D('200'))).toBe(true);
      expect(isTriggered(order('BUY', 'STOP', '200'), D('199.99'))).toBe(false);
      expect(isTriggered(order('SELL', 'STOP', '180'), D('180'))).toBe(true);
      expect(isTriggered(order('SELL', 'STOP', '180'), D('180.01'))).toBe(
        false,
      );
    });
  });

  it('reservedCash: the worst-case cost plus its commission', () => {
    const limitBuy = {
      type: 'LIMIT' as const,
      quantity: 10,
      limitPrice: D('180'),
      stopPrice: null,
    };
    // 1800 + min commission 1.00
    expect(reservedCash(REAL, limitBuy).toFixed(2)).toBe('1801.00');
    expect(reservedCash(FREE, limitBuy).toFixed(2)).toBe('1800.00');
  });
});
