import { describe, it, expect } from 'vitest';
import {
  computeForecast,
  REVEAL_THRESHOLD,
  type ForecastParty,
  type ForecastPickEntry,
  type ForecastPickInput,
} from './forecast';

// Helper: build a pick input with a given submittedAt + entries.
function pick(
  submittedAt: Date | null = new Date('2026-01-01T00:00:00Z'),
  entries: ForecastPickEntry[] = [],
): ForecastPickInput {
  return { submittedAt, entries };
}

// Helper: a party with a bloc tag (and optional baseline for movers tests).
function party(
  id: string,
  bloc: ForecastParty['bloc'] = 'UNALIGNED',
  baselineMandates: number | null = null,
): ForecastParty {
  return { id, bloc, baselineMandates };
}

// Build N identical submitted picks from a partyId->mandates map.
function nPicks(n: number, mandates: Record<string, number>): ForecastPickInput[] {
  const entries = Object.entries(mandates).map(([partyId, m]) => ({ partyId, mandates: m }));
  return Array.from({ length: n }, () => pick(new Date('2026-01-01T00:00:00Z'), entries));
}

describe('computeForecast — participation count', () => {
  it('counts every submitted pick', () => {
    const res = computeForecast([pick(), pick(), pick()]);
    expect(res.participantCount).toBe(3);
  });

  it('is 0 for no picks', () => {
    expect(computeForecast([]).participantCount).toBe(0);
  });
});

describe('computeForecast — eligibility filtering', () => {
  it('excludes drafts (submittedAt === null)', () => {
    const res = computeForecast([pick(), pick(null), pick(), pick(null)]);
    expect(res.participantCount).toBe(2);
  });

  it('counts 0 when every pick is a draft', () => {
    const res = computeForecast([pick(null), pick(null)]);
    expect(res.participantCount).toBe(0);
  });
});

describe('computeForecast — numbersVisible threshold gating', () => {
  it('withholds all numbers below the threshold (count only)', () => {
    const res = computeForecast(nPicks(REVEAL_THRESHOLD - 1, { a: 120 }), [party('a', 'A')]);
    expect(res.numbersVisible).toBe(false);
    expect(res.participantCount).toBe(REVEAL_THRESHOLD - 1);
    expect(res.parties).toBeNull();
    expect(res.blocTally).toBeNull();
    expect(res.blocCall).toBeNull();
    expect(res.largestPartyIds).toBeNull();
  });

  it('reveals numbers exactly AT the threshold (boundary)', () => {
    const res = computeForecast(nPicks(REVEAL_THRESHOLD, { a: 120 }), [party('a', 'A')]);
    expect(res.numbersVisible).toBe(true);
    expect(res.parties).not.toBeNull();
    expect(res.blocCall).not.toBeNull();
  });

  it('drafts do not count toward crossing the threshold', () => {
    // REVEAL_THRESHOLD-1 submitted + 5 drafts ⇒ still below ⇒ hidden.
    const submitted = nPicks(REVEAL_THRESHOLD - 1, { a: 120 });
    const drafts = Array.from({ length: 5 }, () => pick(null, [{ partyId: 'a', mandates: 120 }]));
    const res = computeForecast([...submitted, ...drafts], [party('a', 'A')]);
    expect(res.numbersVisible).toBe(false);
  });
});

describe('computeForecast — trimmed stats resist a cluster vs a raw mean', () => {
  it('a coordinated cluster of extreme picks moves the trimmed average far less than a raw mean would', () => {
    // 90% of the crowd predicts party "a" at 30; a coordinated 10% cluster screams 120.
    const honest = nPicks(Math.round(REVEAL_THRESHOLD * 0.9), { a: 30, b: 90 });
    const cluster = nPicks(REVEAL_THRESHOLD - Math.round(REVEAL_THRESHOLD * 0.9), { a: 120, b: 0 });
    const all = [...honest, ...cluster];

    const res = computeForecast(all, [party('a', 'A'), party('b', 'B')]);
    const avgA = res.parties!.find((p) => p.partyId === 'a')!.avgMandates;

    // Raw mean would be 0.9*30 + 0.1*120 = 39. The 10% trim drops the top tail (the
    // 120 cluster) entirely, so the trimmed mean snaps back to the honest 30.
    const rawMean = 0.9 * 30 + 0.1 * 120;
    expect(rawMean).toBeCloseTo(39, 5);
    expect(avgA).toBe(30);
    expect(avgA).toBeLessThan(rawMean - 5);
  });

  it('with a symmetric, un-clustered crowd the trimmed mean equals the central value', () => {
    // Everyone agrees on 40 ⇒ trimming changes nothing.
    const res = computeForecast(nPicks(REVEAL_THRESHOLD, { a: 40 }), [party('a', 'A')]);
    expect(res.parties!.find((p) => p.partyId === 'a')!.avgMandates).toBe(40);
  });
});

describe('computeForecast — bloc tally + 3-way call boundaries', () => {
  it('A ≥ 61 ⇒ call A', () => {
    const res = computeForecast(nPicks(REVEAL_THRESHOLD, { a: 61, b: 40, c: 19 }), [
      party('a', 'A'),
      party('b', 'B'),
      party('c', 'UNALIGNED'),
    ]);
    expect(res.blocTally).toEqual({ sumA: 61, sumB: 40 });
    expect(res.blocCall).toBe('A');
  });

  it('B ≥ 61 ⇒ call B', () => {
    const res = computeForecast(nPicks(REVEAL_THRESHOLD, { a: 40, b: 61, c: 19 }), [
      party('a', 'A'),
      party('b', 'B'),
      party('c', 'UNALIGNED'),
    ]);
    expect(res.blocCall).toBe('B');
  });

  it('neither bloc reaches 61 ⇒ HUNG', () => {
    const res = computeForecast(nPicks(REVEAL_THRESHOLD, { a: 50, b: 50, c: 20 }), [
      party('a', 'A'),
      party('b', 'B'),
      party('c', 'UNALIGNED'),
    ]);
    expect(res.blocCall).toBe('HUNG');
  });

  it('exactly 60 in a bloc is still HUNG (boundary just below)', () => {
    const res = computeForecast(nPicks(REVEAL_THRESHOLD, { a: 60, b: 40, c: 20 }), [
      party('a', 'A'),
      party('b', 'B'),
      party('c', 'UNALIGNED'),
    ]);
    expect(res.blocCall).toBe('HUNG');
  });

  it('UNALIGNED mandates never tip a bloc', () => {
    // A=55, UNALIGNED=65: if UNALIGNED counted, "A side" would win; it must not.
    const res = computeForecast(nPicks(REVEAL_THRESHOLD, { a: 55, c: 65 }), [
      party('a', 'A'),
      party('c', 'UNALIGNED'),
    ]);
    expect(res.blocTally).toEqual({ sumA: 55, sumB: 0 });
    expect(res.blocCall).toBe('HUNG');
  });
});

describe('computeForecast — largest-party call (ties allowed)', () => {
  it('single clear largest', () => {
    const res = computeForecast(nPicks(REVEAL_THRESHOLD, { a: 50, b: 40, c: 30 }), [
      party('a', 'A'),
      party('b', 'B'),
      party('c', 'UNALIGNED'),
    ]);
    expect(res.largestPartyIds).toEqual(['a']);
    // Sorted descending by average.
    expect(res.parties!.map((p) => p.partyId)).toEqual(['a', 'b', 'c']);
  });

  it('tie at the top returns every tied party', () => {
    const res = computeForecast(nPicks(REVEAL_THRESHOLD, { a: 45, b: 45, c: 30 }), [
      party('a', 'A'),
      party('b', 'B'),
      party('c', 'UNALIGNED'),
    ]);
    expect(res.largestPartyIds!.sort()).toEqual(['a', 'b']);
  });

  it('all-zero averages ⇒ no largest party', () => {
    const res = computeForecast(nPicks(REVEAL_THRESHOLD, {}), [party('a', 'A'), party('b', 'B')]);
    expect(res.largestPartyIds).toEqual([]);
  });
});

describe('computeForecast — per-party delta vs baseline', () => {
  it('null baseline ⇒ no delta', () => {
    const res = computeForecast(nPicks(REVEAL_THRESHOLD, { a: 30, b: 90 }), [
      party('a', 'A', null),
      party('b', 'B', null),
    ]);
    expect(res.parties!.every((p) => p.delta === null)).toBe(true);
  });

  it('baseline 0 ⇒ delta equals the full forecast (brand-new entrant)', () => {
    const res = computeForecast(nPicks(REVEAL_THRESHOLD, { a: 18, b: 102 }), [
      party('a', 'A', 0),
      party('b', 'B', 30),
    ]);
    const a = res.parties!.find((p) => p.partyId === 'a')!;
    // avg 18, baseline 0 ⇒ delta == avg.
    expect(a.avgMandates).toBe(18);
    expect(a.delta).toBe(18);
  });

  it('positive baseline ⇒ delta = trimmedAvg − baseline (gain and loss)', () => {
    const res = computeForecast(nPicks(REVEAL_THRESHOLD, { a: 40, b: 80 }), [
      party('a', 'A', 30), // 40 - 30 = +10
      party('b', 'B', 95), // 80 - 95 = -15
    ]);
    const a = res.parties!.find((p) => p.partyId === 'a')!;
    const b = res.parties!.find((p) => p.partyId === 'b')!;
    expect(a.delta).toBe(10);
    expect(b.delta).toBe(-15);
  });
});

describe('computeForecast — biggest movers', () => {
  it('only parties with a non-null baseline are eligible to move', () => {
    const res = computeForecast(nPicks(REVEAL_THRESHOLD, { a: 50, b: 40, c: 30 }), [
      party('a', 'A', 30), // +20 gainer
      party('b', 'B', null), // no baseline ⇒ never a mover
      party('c', 'UNALIGNED', 50), // -20 loser
    ]);
    expect(res.biggestGainers!.map((m) => m.partyId)).toEqual(['a']);
    expect(res.biggestLosers!.map((m) => m.partyId)).toEqual(['c']);
    // b (no baseline) appears in neither list.
    const allMoverIds = [...res.biggestGainers!, ...res.biggestLosers!].map((m) => m.partyId);
    expect(allMoverIds).not.toContain('b');
  });

  it('gainers sorted most-positive first, losers most-negative first', () => {
    const res = computeForecast(nPicks(REVEAL_THRESHOLD, { a: 40, b: 50, c: 10, d: 20 }), [
      party('a', 'A', 30), // +10
      party('b', 'B', 30), // +20
      party('c', 'UNALIGNED', 40), // -30
      party('d', 'A', 35), // -15
    ]);
    expect(res.biggestGainers!.map((m) => m.partyId)).toEqual(['b', 'a']);
    expect(res.biggestLosers!.map((m) => m.partyId)).toEqual(['c', 'd']);
  });

  it('a zero delta is neither a gainer nor a loser', () => {
    const res = computeForecast(nPicks(REVEAL_THRESHOLD, { a: 30, b: 90 }), [
      party('a', 'A', 30), // delta 0
      party('b', 'B', 80), // +10
    ]);
    expect(res.biggestGainers!.map((m) => m.partyId)).toEqual(['b']);
    expect(res.biggestLosers).toEqual([]);
  });

  it('no baselines anywhere ⇒ both mover lists empty', () => {
    const res = computeForecast(nPicks(REVEAL_THRESHOLD, { a: 60, b: 60 }), [
      party('a', 'A', null),
      party('b', 'B', null),
    ]);
    expect(res.biggestGainers).toEqual([]);
    expect(res.biggestLosers).toEqual([]);
  });

  it('movers are null (withheld) below the threshold', () => {
    const res = computeForecast(nPicks(REVEAL_THRESHOLD - 1, { a: 60, b: 60 }), [
      party('a', 'A', 30),
      party('b', 'B', 30),
    ]);
    expect(res.biggestGainers).toBeNull();
    expect(res.biggestLosers).toBeNull();
  });
});

describe('computeForecast — missing entries treated as 0', () => {
  it('a pick missing a party contributes 0 mandates for that party', () => {
    // Half predict b=20, half omit b entirely. Trimmed mean should drop toward 0.
    const withB = nPicks(REVEAL_THRESHOLD / 2, { a: 100, b: 20 });
    const withoutB = nPicks(REVEAL_THRESHOLD / 2, { a: 120 });
    const res = computeForecast([...withB, ...withoutB], [party('a', 'A'), party('b', 'B')]);
    const avgB = res.parties!.find((p) => p.partyId === 'b')!.avgMandates;
    // Trimming the top tail (the 20s) on a half-zero distribution yields 0.
    expect(avgB).toBeLessThan(20);
  });
});
