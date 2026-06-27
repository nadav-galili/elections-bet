import { describe, it, expect } from 'vitest';
import { rankEntries, type LeaderboardEntry } from './leaderboard';

function entry(p: Partial<LeaderboardEntry> & { userId: string; total: number }): LeaderboardEntry {
  return {
    submittedAt: null,
    displayName: null,
    avatarUrl: null,
    ...p,
  };
}

describe('rankEntries', () => {
  it('gives distinct totals standard competition ranks (1, 2, 3)', () => {
    const rows = rankEntries([
      entry({ userId: 'a', total: 100 }),
      entry({ userId: 'b', total: 80 }),
      entry({ userId: 'c', total: 60 }),
    ]);
    expect(rows.map((r) => [r.userId, r.rank])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
  });

  it('shares a rank for equal totals and skips the next (1, 1, 3)', () => {
    const rows = rankEntries([
      entry({ userId: 'a', total: 100, submittedAt: new Date('2026-01-01T00:00:00Z') }),
      entry({ userId: 'b', total: 100, submittedAt: new Date('2026-01-02T00:00:00Z') }),
      entry({ userId: 'c', total: 50 }),
    ]);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it('orders equal totals by earlier submittedAt first', () => {
    const rows = rankEntries([
      entry({ userId: 'late', total: 90, submittedAt: new Date('2026-01-05T00:00:00Z') }),
      entry({ userId: 'early', total: 90, submittedAt: new Date('2026-01-01T00:00:00Z') }),
    ]);
    expect(rows.map((r) => r.userId)).toEqual(['early', 'late']);
    // Same total ⇒ same shared rank regardless of order.
    expect(rows.map((r) => r.rank)).toEqual([1, 1]);
  });

  it('sorts a null submittedAt LAST within the same total', () => {
    const rows = rankEntries([
      entry({ userId: 'nullsub', total: 70, submittedAt: null }),
      entry({ userId: 'hassub', total: 70, submittedAt: new Date('2026-01-09T00:00:00Z') }),
    ]);
    expect(rows.map((r) => r.userId)).toEqual(['hassub', 'nullsub']);
  });

  it('breaks a full tie (same total + same submittedAt) by userId ASC', () => {
    const at = new Date('2026-01-01T00:00:00Z');
    const rows = rankEntries([
      entry({ userId: 'zeta', total: 60, submittedAt: at }),
      entry({ userId: 'alpha', total: 60, submittedAt: at }),
      entry({ userId: 'mike', total: 60, submittedAt: at }),
    ]);
    expect(rows.map((r) => r.userId)).toEqual(['alpha', 'mike', 'zeta']);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 1]);
  });

  it('is pure: does not mutate the input array', () => {
    const input = [entry({ userId: 'a', total: 10 }), entry({ userId: 'b', total: 20 })];
    const snapshot = input.map((e) => e.userId);
    rankEntries(input);
    expect(input.map((e) => e.userId)).toEqual(snapshot);
  });

  it('carries through displayName, avatarUrl and total onto the row', () => {
    const rows = rankEntries([
      entry({ userId: 'a', total: 42, displayName: 'נדב', avatarUrl: 'http://x/a.png' }),
    ]);
    expect(rows[0]).toEqual({
      rank: 1,
      userId: 'a',
      displayName: 'נדב',
      avatarUrl: 'http://x/a.png',
      total: 42,
    });
  });

  it('returns an empty array for no entries', () => {
    expect(rankEntries([])).toEqual([]);
  });
});
