import { describe, it, expect } from 'vitest';
import { IL_TZ, formatInIsrael, israelWallClockToUtc, isLocked, isRevealed } from './time';

// Israel ends DST in late October. We pick a summer date (early October, IDT
// = UTC+3) and a winter date (early November, IST = UTC+2) that sit cleanly on
// either side of the transition, and prove the util derives the right offset.
const YEAR = 2026;
const OCT = 9; // monthIndex0 for October
const NOV = 10; // monthIndex0 for November

// Derive the zone's offset (minutes) for an absolute instant straight from the
// tz database, so the test's "expected" is anchored to the same source of
// truth the implementation must match — not a hand-typed magic number.
function tzOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: IL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  let hour = get('hour');
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    hour,
    get('minute'),
    get('second'),
  );
  return (asUtc - instant.getTime()) / 60000;
}

// The Israel local hour an instant renders as (0-23), read from formatInIsrael.
function israelHour(date: Date): number {
  // he-IL format is "DD.MM.YYYY, HH:mm:ss"; pull the HH.
  const hh = formatInIsrael(date).match(/(\d{2}):\d{2}:\d{2}/);
  if (!hh) throw new Error(`unexpected format: ${formatInIsrael(date)}`);
  return Number(hh[1]);
}

describe('israelWallClockToUtc — DST awareness', () => {
  it('maps a 20:00 summer wall-clock lock to 17:00Z (IDT, +3)', () => {
    const utc = israelWallClockToUtc(YEAR, OCT, 5, 20, 0);
    expect(utc.toISOString()).toBe('2026-10-05T17:00:00.000Z');
    // And the derived offset really is +3h.
    expect(tzOffsetMinutes(utc)).toBe(180);
  });

  it('maps the same 20:00 winter wall-clock lock to 18:00Z (IST, +2)', () => {
    const utc = israelWallClockToUtc(YEAR, NOV, 5, 20, 0);
    expect(utc.toISOString()).toBe('2026-11-05T18:00:00.000Z');
    expect(tzOffsetMinutes(utc)).toBe(120);
  });

  it('proves the offset genuinely differs across the DST boundary (+3 vs +2)', () => {
    const summer = israelWallClockToUtc(YEAR, OCT, 5, 20, 0);
    const winter = israelWallClockToUtc(YEAR, NOV, 5, 20, 0);
    const summerOffset = tzOffsetMinutes(summer);
    const winterOffset = tzOffsetMinutes(winter);
    expect(summerOffset).toBe(180);
    expect(winterOffset).toBe(120);
    // Same 20:00 wall-clock, one hour apart in absolute (UTC) terms.
    expect(summerOffset - winterOffset).toBe(60);
  });
});

describe('formatInIsrael — local hour on each side of the transition', () => {
  it('renders the summer instant at the 20:00 Israel wall-clock hour', () => {
    const utc = israelWallClockToUtc(YEAR, OCT, 5, 20, 0);
    expect(israelHour(utc)).toBe(20);
  });

  it('renders the winter instant at the 20:00 Israel wall-clock hour', () => {
    const utc = israelWallClockToUtc(YEAR, NOV, 5, 20, 0);
    expect(israelHour(utc)).toBe(20);
  });

  it('round-trips: the same absolute instant reads 20:00 in both seasons', () => {
    // Two distinct instants (17:00Z summer, 18:00Z winter) both show 20:00 IL.
    const summer = israelWallClockToUtc(YEAR, OCT, 5, 20, 0);
    const winter = israelWallClockToUtc(YEAR, NOV, 5, 20, 0);
    expect(summer.getTime()).not.toBe(winter.getTime());
    expect(israelHour(summer)).toBe(israelHour(winter));
  });
});

describe('isLocked', () => {
  it('is false when lockAt is null (never locks)', () => {
    expect(isLocked(null)).toBe(false);
    expect(isLocked(null, new Date('2099-01-01T00:00:00.000Z'))).toBe(false);
  });

  it('is false just before lockAt and true at/after it, across the DST boundary', () => {
    // A 20:00 Israel lock that lands near the autumn transition.
    const lockAt = israelWallClockToUtc(YEAR, NOV, 5, 20, 0); // 18:00Z
    const justBefore = new Date(lockAt.getTime() - 1000);
    const exactly = new Date(lockAt.getTime());
    const justAfter = new Date(lockAt.getTime() + 1000);

    expect(isLocked(lockAt, justBefore)).toBe(false);
    expect(isLocked(lockAt, exactly)).toBe(true); // now >= lockAt
    expect(isLocked(lockAt, justAfter)).toBe(true);
  });
});

describe('isRevealed', () => {
  it('is false when revealAt is null (never reveals)', () => {
    expect(isRevealed(null)).toBe(false);
    expect(isRevealed(null, new Date('2099-01-01T00:00:00.000Z'))).toBe(false);
  });

  it('is false just before revealAt and true at/after it', () => {
    const revealAt = israelWallClockToUtc(YEAR, OCT, 5, 20, 2); // summer, 17:02Z
    const justBefore = new Date(revealAt.getTime() - 1000);
    const exactly = new Date(revealAt.getTime());
    const justAfter = new Date(revealAt.getTime() + 1000);

    expect(isRevealed(revealAt, justBefore)).toBe(false);
    expect(isRevealed(revealAt, exactly)).toBe(true);
    expect(isRevealed(revealAt, justAfter)).toBe(true);
  });
});
