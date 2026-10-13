import {
  getMarketStatus,
  isTradingDay,
  lastSession,
  sessionClose,
  sessionOpen,
} from './market-calendar.js';

describe('market calendar', () => {
  describe('getMarketStatus', () => {
    it('is open during regular hours (10:00 New York, EDT = UTC-4)', () => {
      const status = getMarketStatus(new Date('2026-10-13T14:00:00Z'));

      expect(status).toEqual({
        isOpen: true,
        session: 'REGULAR',
        timezone: 'America/New_York',
        nextOpen: '2026-10-14T13:30:00.000Z',
        nextClose: '2026-10-13T20:00:00.000Z',
      });
    });

    it('is pre-market at 8:00, opening the same day', () => {
      const status = getMarketStatus(new Date('2026-10-13T12:00:00Z'));

      expect(status.isOpen).toBe(false);
      expect(status.session).toBe('PRE_MARKET');
      expect(status.nextOpen).toBe('2026-10-13T13:30:00.000Z');
      expect(status.nextClose).toBeNull();
    });

    it('is after-hours at 17:00, opening the next day', () => {
      const status = getMarketStatus(new Date('2026-10-13T21:00:00Z'));

      expect(status.session).toBe('AFTER_HOURS');
      expect(status.nextOpen).toBe('2026-10-14T13:30:00.000Z');
    });

    it('is closed on a Saturday, opening on Monday', () => {
      const status = getMarketStatus(new Date('2026-10-17T15:00:00Z'));

      expect(status.session).toBe('CLOSED');
      expect(status.nextOpen).toBe('2026-10-19T13:30:00.000Z');
    });

    it('is closed on Thanksgiving, opening the next day (EST = UTC-5)', () => {
      const status = getMarketStatus(new Date('2026-11-26T16:00:00Z'));

      expect(status.session).toBe('CLOSED');
      expect(status.nextOpen).toBe('2026-11-27T14:30:00.000Z');
    });
  });

  it('knows weekends and holidays (observed dates)', () => {
    expect(isTradingDay('2026-10-13')).toBe(true); // Tuesday
    expect(isTradingDay('2026-10-17')).toBe(false); // Saturday
    expect(isTradingDay('2026-07-03')).toBe(false); // July 4th falls on a Saturday
    expect(isTradingDay('2026-12-25')).toBe(false); // Christmas
  });

  it('follows daylight saving time: the open is 9:30 New York all year', () => {
    // US clocks spring forward on Sunday 2026-03-08
    expect(sessionOpen('2026-03-06').toISOString()).toBe(
      '2026-03-06T14:30:00.000Z',
    );
    expect(sessionOpen('2026-03-09').toISOString()).toBe(
      '2026-03-09T13:30:00.000Z',
    );
    expect(sessionClose('2026-03-09').toISOString()).toBe(
      '2026-03-09T20:00:00.000Z',
    );
  });

  describe('lastSession', () => {
    it('is today, up to now, while the market is open', () => {
      const now = new Date('2026-10-13T15:00:00Z');

      expect(lastSession(now)).toEqual({ date: '2026-10-13', until: now });
    });

    it("is Friday's session, frozen at its close, on a weekend", () => {
      expect(lastSession(new Date('2026-10-17T15:00:00Z'))).toEqual({
        date: '2026-10-16',
        until: new Date('2026-10-16T20:00:00Z'),
      });
    });

    it("is yesterday's session before today's open", () => {
      expect(lastSession(new Date('2026-10-13T12:00:00Z')).date).toBe(
        '2026-10-12',
      );
    });
  });
});
