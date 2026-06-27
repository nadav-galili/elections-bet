import { describe, it, expect } from 'vitest';
import { formatCountdown, formatDateTime, formatDate, formatTime } from './time';

describe('formatCountdown', () => {
  it('zero-pads hours, minutes and seconds', () => {
    // 1h 2m 3s
    const ms = (1 * 3600 + 2 * 60 + 3) * 1000;
    expect(formatCountdown(ms)).toBe('01:02:03');
  });

  it('renders all zeros for 0ms', () => {
    expect(formatCountdown(0)).toBe('00:00:00');
  });

  it('clamps negative values to zero', () => {
    expect(formatCountdown(-5000)).toBe('00:00:00');
  });

  it('prefixes the day count (in Hebrew) when there is at least one full day', () => {
    // 2 days, 3h 4m 5s
    const ms = (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000;
    expect(formatCountdown(ms)).toBe('2 ימים 03:04:05');
  });
});

describe('formatDateTime', () => {
  it('pins formatting to Asia/Jerusalem he-IL', () => {
    // 2026-06-27T17:02:00Z === 20:02 in Asia/Jerusalem (UTC+3 in summer)
    const out = formatDateTime('2026-06-27T17:02:00.000Z');
    expect(out).toContain('20:02');
    // he-IL short date for 27 June 2026
    expect(out).toContain('27');
    expect(out).toContain('6');
    expect(out).toContain('2026');
  });

  it('returns the fallback for null', () => {
    expect(formatDateTime(null)).toBe('—');
  });

  it('returns the fallback for undefined', () => {
    expect(formatDateTime(undefined)).toBe('—');
  });

  it('returns the fallback for an invalid date string', () => {
    expect(formatDateTime('not-a-date')).toBe('—');
  });

  it('accepts a custom fallback', () => {
    expect(formatDateTime(null, 'אין מועד')).toBe('אין מועד');
  });
});

describe('formatDate / formatTime', () => {
  it('formatDate returns the date pinned to Asia/Jerusalem and falls back on null', () => {
    const out = formatDate('2026-06-27T17:02:00.000Z');
    expect(out).toContain('27');
    expect(out).toContain('2026');
    expect(out).not.toContain('20:02');
    expect(formatDate(null)).toBe('—');
  });

  it('formatTime returns the Asia/Jerusalem time and falls back on invalid input', () => {
    expect(formatTime('2026-06-27T17:02:00.000Z')).toBe('20:02');
    expect(formatTime('nope')).toBe('—');
  });
});
