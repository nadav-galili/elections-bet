import { describe, it, expect, beforeEach, vi } from 'vitest';

// The snapshot service is impure (DB + module-level single-flight state), so we mock
// `../db` and drive it with injectable `now`/`ttl` rather than sleeping — mirroring
// how lib/time.ts takes a `now` param.
vi.mock('../db', () => ({
  prisma: {
    pick: { findMany: vi.fn() },
    party: { findMany: vi.fn() },
    forecastSnapshot: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

import { prisma } from '../db';
import { getForecastSnapshot, SNAPSHOT_TTL_MS } from './forecast-snapshot';
import { REVEAL_THRESHOLD } from './forecast';

const mocked = prisma as unknown as {
  pick: { findMany: ReturnType<typeof vi.fn> };
  party: { findMany: ReturnType<typeof vi.fn> };
  forecastSnapshot: Record<'findUnique' | 'upsert', ReturnType<typeof vi.fn>>;
};

type Entry = { partyId: string; mandates: number };
function submitted(entries: Entry[] = []) {
  return { submittedAt: new Date('2026-01-01T00:00:00Z'), entries };
}

/** A stored snapshot row blob, as persisted by recomputeAndPersist. */
function storedRow(opts: {
  computedAt: Date;
  participantCount: number;
  parties?: Record<string, string>;
}) {
  return {
    id: 's1',
    electionId: 'e1',
    participantCount: opts.participantCount,
    computedAt: opts.computedAt,
    data: {
      forecast: {
        participantCount: opts.participantCount,
        numbersVisible: false,
        parties: null,
        blocTally: null,
        blocCall: null,
        largestPartyIds: null,
        biggestGainers: null,
        biggestLosers: null,
      },
      partyNames: opts.parties ?? {},
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.party.findMany.mockResolvedValue([]);
  mocked.pick.findMany.mockResolvedValue([]);
  mocked.forecastSnapshot.upsert.mockResolvedValue({});
});

describe('getForecastSnapshot — materialized cache', () => {
  it('cold (no snapshot): recomputes from picks/parties and persists a row', async () => {
    mocked.forecastSnapshot.findUnique.mockResolvedValue(null);
    mocked.pick.findMany.mockResolvedValue([submitted(), submitted(), submitted()]);

    const now = new Date('2026-06-28T10:00:00Z');
    const result = await getForecastSnapshot('e1', now);

    expect(result.forecast.participantCount).toBe(3);
    expect(result.computedAt).toEqual(now);
    // It recomputed (read the picks) AND persisted the snapshot.
    expect(mocked.pick.findMany).toHaveBeenCalledOnce();
    expect(mocked.forecastSnapshot.upsert).toHaveBeenCalledOnce();
    expect(mocked.forecastSnapshot.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { electionId: 'e1' },
        create: expect.objectContaining({ participantCount: 3, computedAt: now }),
        update: expect.objectContaining({ participantCount: 3, computedAt: now }),
      }),
    );
  });

  it('fresh (within window): serves the stored snapshot WITHOUT recomputing', async () => {
    const computedAt = new Date('2026-06-28T08:00:00Z');
    mocked.forecastSnapshot.findUnique.mockResolvedValue(
      storedRow({ computedAt, participantCount: 42, parties: { a: 'הליכוד' } }),
    );

    // 1h later — well within the 8h TTL.
    const now = new Date(computedAt.getTime() + 60 * 60 * 1000);
    const result = await getForecastSnapshot('e1', now);

    expect(result.forecast.participantCount).toBe(42);
    expect(result.computedAt).toEqual(computedAt);
    expect(result.partyNames.get('a')).toBe('הליכוד');
    // Served from the row: no recompute, no persist.
    expect(mocked.pick.findMany).not.toHaveBeenCalled();
    expect(mocked.forecastSnapshot.upsert).not.toHaveBeenCalled();
  });

  it('stale (past window): the first reader recomputes, persists, and gets fresh numbers', async () => {
    const computedAt = new Date('2026-06-28T00:00:00Z');
    mocked.forecastSnapshot.findUnique.mockResolvedValue(
      storedRow({ computedAt, participantCount: 5 }),
    );
    // The recompute should reflect NEW picks (10), not the stale 5.
    mocked.pick.findMany.mockResolvedValue(Array.from({ length: 10 }, () => submitted()));

    // Past the 8h TTL.
    const now = new Date(computedAt.getTime() + SNAPSHOT_TTL_MS + 1);
    const result = await getForecastSnapshot('e1', now);

    expect(result.forecast.participantCount).toBe(10);
    expect(result.computedAt).toEqual(now);
    expect(mocked.pick.findMany).toHaveBeenCalledOnce();
    expect(mocked.forecastSnapshot.upsert).toHaveBeenCalledOnce();
  });

  it('exactly at the TTL boundary counts as stale and recomputes', async () => {
    const computedAt = new Date('2026-06-28T00:00:00Z');
    mocked.forecastSnapshot.findUnique.mockResolvedValue(
      storedRow({ computedAt, participantCount: 5 }),
    );
    mocked.pick.findMany.mockResolvedValue([submitted()]);

    const now = new Date(computedAt.getTime() + SNAPSHOT_TTL_MS);
    await getForecastSnapshot('e1', now);
    expect(mocked.forecastSnapshot.upsert).toHaveBeenCalledOnce();
  });

  it('single-flight: concurrent post-expiry reads recompute ONCE; others serve stale until ready', async () => {
    const computedAt = new Date('2026-06-28T00:00:00Z');
    mocked.forecastSnapshot.findUnique.mockResolvedValue(
      storedRow({ computedAt, participantCount: 5 }),
    );

    // Make the recompute's DB read hang until we release it, so all three readers
    // overlap on the same in-flight recompute.
    let releasePicks: (v: unknown[]) => void = () => {};
    const picksPromise = new Promise<unknown[]>((resolve) => {
      releasePicks = resolve;
    });
    mocked.pick.findMany.mockReturnValue(picksPromise);

    const now = new Date(computedAt.getTime() + SNAPSHOT_TTL_MS + 1);
    const r1 = getForecastSnapshot('e1', now);
    const r2 = getForecastSnapshot('e1', now);
    const r3 = getForecastSnapshot('e1', now);

    // Let the synchronous findUnique resolutions flush so r2/r3 observe the in-flight lock.
    await Promise.resolve();
    await Promise.resolve();

    // Release the single recompute.
    releasePicks(Array.from({ length: 9 }, () => submitted()));
    const [a, b, c] = await Promise.all([r1, r2, r3]);

    // Exactly one recompute + one persist despite three concurrent reads.
    expect(mocked.pick.findMany).toHaveBeenCalledOnce();
    expect(mocked.forecastSnapshot.upsert).toHaveBeenCalledOnce();

    // The first reader got fresh numbers; the others served the stale snapshot.
    const counts = [a, b, c].map((r) => r.forecast.participantCount).sort((x, y) => x - y);
    expect(counts).toEqual([5, 5, 9]);
  });

  it('after an in-flight recompute settles, the next read can recompute again', async () => {
    const computedAt = new Date('2026-06-28T00:00:00Z');
    mocked.forecastSnapshot.findUnique.mockResolvedValue(
      storedRow({ computedAt, participantCount: 5 }),
    );
    mocked.pick.findMany.mockResolvedValue([submitted()]);

    const now = new Date(computedAt.getTime() + SNAPSHOT_TTL_MS + 1);
    await getForecastSnapshot('e1', now); // first recompute, lock released on settle
    await getForecastSnapshot('e1', now); // lock free again ⇒ recomputes

    expect(mocked.forecastSnapshot.upsert).toHaveBeenCalledTimes(2);
  });

  it('persists the full computed forecast shape (numbers above threshold)', async () => {
    mocked.forecastSnapshot.findUnique.mockResolvedValue(null);
    mocked.party.findMany.mockResolvedValue([
      { id: 'a', nameHe: 'הליכוד', bloc: 'A', baselineMandates: null },
      { id: 'b', nameHe: 'יש עתיד', bloc: 'B', baselineMandates: null },
    ]);
    mocked.pick.findMany.mockResolvedValue(
      Array.from({ length: REVEAL_THRESHOLD }, () =>
        submitted([
          { partyId: 'a', mandates: 70 },
          { partyId: 'b', mandates: 50 },
        ]),
      ),
    );

    const result = await getForecastSnapshot('e1', new Date());
    expect(result.forecast.numbersVisible).toBe(true);
    expect(result.forecast.blocCall).toBe('A');
    expect(result.partyNames.get('a')).toBe('הליכוד');
    // The persisted blob carries the same full shape.
    const upsertArg = mocked.forecastSnapshot.upsert.mock.calls[0][0];
    expect(upsertArg.create.data.forecast.numbersVisible).toBe(true);
    expect(upsertArg.create.data.partyNames).toEqual({ a: 'הליכוד', b: 'יש עתיד' });
  });
});
