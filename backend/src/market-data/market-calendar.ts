import type { MarketSession, MarketStatus } from './market-data.types.js';

// US stock market (NYSE/Nasdaq) regular hours: 9:30-16:00 New York time.
// Pure functions of a Date, so they are easy to test with any moment.
export const MARKET_TIMEZONE = 'America/New_York';
export const SESSION_SECONDS = 6.5 * 60 * 60;

const OPEN_MINUTES = 9 * 60 + 30;
const CLOSE_MINUTES = 16 * 60;
const PRE_MARKET_MINUTES = 4 * 60;
const AFTER_HOURS_END_MINUTES = 20 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;

// Full-day closures (observed dates). Early closes (13:00 on some days) are
// not modelled. Extend this list every year.
const HOLIDAYS = new Set([
  '2026-01-01',
  '2026-01-19',
  '2026-02-16',
  '2026-04-03',
  '2026-05-25',
  '2026-06-19',
  '2026-07-03',
  '2026-09-07',
  '2026-11-26',
  '2026-12-25',
  '2027-01-01',
  '2027-01-18',
  '2027-02-15',
  '2027-03-26',
  '2027-05-31',
  '2027-06-18',
  '2027-07-05',
  '2027-09-06',
  '2027-11-25',
  '2027-12-24',
]);

const etFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: MARKET_TIMEZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

// The New York wall-clock time of an instant
function etParts(instant: Date) {
  const parts = Object.fromEntries(
    etFormatter.formatToParts(instant).map((p) => [p.type, Number(p.value)]),
  );
  return {
    date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    minutes: parts.hour * 60 + parts.minute,
    // Same wall-clock reading, as if it were UTC: used to find the offset
    asUtcMs: Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ),
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** "YYYY-MM-DD" of the instant, in New York */
export function etDate(instant: Date): string {
  return etParts(instant).date;
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function isTradingDay(date: string): boolean {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !HOLIDAYS.has(date);
}

/** The UTC instant of a New York wall-clock time (handles daylight saving) */
export function etToUtc(date: string, minutesOfDay: number): Date {
  const wallClockAsUtc =
    Date.parse(`${date}T00:00:00Z`) + minutesOfDay * 60_000;
  // New York is 4 or 5 hours behind UTC; measure it at that moment
  const offset = etParts(new Date(wallClockAsUtc)).asUtcMs - wallClockAsUtc;
  const guess = wallClockAsUtc - offset;
  // Re-measure at the result, in case the guess crossed a DST switch
  return new Date(wallClockAsUtc - (etParts(new Date(guess)).asUtcMs - guess));
}

// etToUtc() runs Intl formatting, which is slow, and charts ask for the same
// session times thousands of times. A trading day's open/close never changes,
// so remember them (a few hundred entries a year).
const sessionTimes = new Map<string, number>();

function cachedEtToUtc(date: string, minutesOfDay: number): Date {
  const key = `${date}|${minutesOfDay}`;
  let ms = sessionTimes.get(key);
  if (ms === undefined) {
    ms = etToUtc(date, minutesOfDay).getTime();
    sessionTimes.set(key, ms);
  }
  return new Date(ms);
}

export function sessionOpen(date: string): Date {
  return cachedEtToUtc(date, OPEN_MINUTES);
}

export function sessionClose(date: string): Date {
  return cachedEtToUtc(date, CLOSE_MINUTES);
}

export function previousTradingDay(date: string): string {
  let day = addDays(date, -1);
  while (!isTradingDay(day)) {
    day = addDays(day, -1);
  }
  return day;
}

export function nextTradingDay(date: string): string {
  let day = addDays(date, 1);
  while (!isTradingDay(day)) {
    day = addDays(day, 1);
  }
  return day;
}

/**
 * The last trading day whose session has started by `now`, and the moment
 * prices froze (now while the market is open, else that session's close).
 */
export function lastSession(now: Date): { date: string; until: Date } {
  const today = etDate(now);
  if (isTradingDay(today) && now >= sessionOpen(today)) {
    const close = sessionClose(today);
    return { date: today, until: now < close ? now : close };
  }
  const day = previousTradingDay(today);
  return { date: day, until: sessionClose(day) };
}

export function getMarketStatus(now: Date): MarketStatus {
  const { date, minutes } = etParts(now);
  const tradingDay = isTradingDay(date);

  let session: MarketSession = 'CLOSED';
  if (tradingDay) {
    if (minutes >= OPEN_MINUTES && minutes < CLOSE_MINUTES) {
      session = 'REGULAR';
    } else if (minutes >= PRE_MARKET_MINUTES && minutes < OPEN_MINUTES) {
      session = 'PRE_MARKET';
    } else if (minutes >= CLOSE_MINUTES && minutes < AFTER_HOURS_END_MINUTES) {
      session = 'AFTER_HOURS';
    }
  }

  const isOpen = session === 'REGULAR';
  const opensToday = tradingDay && minutes < OPEN_MINUTES;
  const nextOpenDate = opensToday ? date : nextTradingDay(date);

  return {
    isOpen,
    session,
    timezone: MARKET_TIMEZONE,
    nextOpen: sessionOpen(nextOpenDate).toISOString(),
    nextClose: isOpen ? sessionClose(date).toISOString() : null,
  };
}
