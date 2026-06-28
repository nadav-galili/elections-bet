// Forecast aggregation — PURE function, no DB / no I/O.
//
// This is the seam the public /forecast page is built on (implementation-plan.md:
// "a game, not a poll"). Given the set of stored picks for an election and its
// parties, it derives the participation figure, the trimmed per-party mandate
// averages, the bloc tally + 3-way call, the predicted largest-party call, and
// whether real numbers may be shown yet.
//
// Slice 2 (crowd numbers): the aggregated numbers are gated behind a credibility
// threshold (REVEAL_THRESHOLD). Below it, only the participation count is exposed
// (numbersVisible=false) and the page keeps the count-as-hero state. At/above it,
// numbersVisible flips on and the bloc verdict + mandate bar may render.
//
// Anti-gaming is deliberately light (implementation-plan.md): one pick per
// (user, election) — enforced upstream — plus TRIMMED stats here, so a coordinated
// cluster of extreme picks can't yank a headline. No friction gates.

import type { Bloc } from './scoring';

/**
 * Reveal threshold N: the minimum number of eligible (submitted) picks before any
 * aggregated number or the bloc verdict is shown. Tuned to ~the low hundreds so no
 * single pick can move a party average by more than ~0.5 mandate (with trimming,
 * the influence of any one pick is bounded further). This is the one knob — change
 * it here to retune the credibility gate.
 */
export const REVEAL_THRESHOLD = 300;

/**
 * Fraction trimmed from EACH tail before averaging. 0.1 ⇒ drop the lowest 10% and
 * the highest 10% of a party's predicted mandates, then mean the middle 80%. This
 * is a symmetric trimmed mean (a generalization of the median), chosen so a
 * coordinated cluster at an extreme can't drag a party's headline average.
 */
export const TRIM_FRACTION = 0.1;

/** The bloc tag a party carries (same vocabulary as the scoring engine). */
export type { Bloc };

/** The minimal shape of a party we need: its id and bloc tag. */
export interface ForecastParty {
  id: string;
  bloc: Bloc;
  /**
   * Prior baseline mandates for the "biggest movers" story, or null. null ⇒ no delta
   * is emitted (we don't pretend to know the prior). 0 ⇒ a brand-new entrant, so the
   * delta equals the full forecast ("predicted to enter with N"). Positive ⇒ the prior
   * baseline (admin judgment on renames/merges/splits). Defaults to null for callers
   * (existing tests) that don't supply it.
   */
  baselineMandates?: number | null;
}

/** A single party prediction within a pick: partyId -> mandates. */
export interface ForecastPickEntry {
  partyId: string;
  mandates: number;
}

/** The minimal shape of a stored pick we need to aggregate. */
export interface ForecastPickInput {
  /**
   * When the pick was submitted, or null for a draft. Only submitted picks count
   * toward participation AND the aggregates. Stored picks already satisfy the
   * sum=120 invariant, so submittedAt is the one thing we filter on here.
   */
  submittedAt: Date | null;
  /** This pick's per-party predicted mandates. Drafts may have partial entries. */
  entries: ForecastPickEntry[];
}

/** A single party's aggregated forecast row. */
export interface PartyForecast {
  partyId: string;
  bloc: Bloc;
  /** Trimmed-mean predicted mandates across eligible picks (1 decimal place). */
  avgMandates: number;
  /**
   * Crowd movement vs the party's prior baseline (`avgMandates − baselineMandates`,
   * 1 decimal place), or null when no baseline is set. A baseline of 0 yields a delta
   * equal to the full forecast (a brand-new entrant). Positive ⇒ gain, negative ⇒ loss.
   */
  delta: number | null;
}

/** A party's movement vs baseline, for the "biggest movers" lists. */
export interface PartyMover {
  partyId: string;
  bloc: Bloc;
  avgMandates: number;
  /** Non-null by construction (movers only exist for parties with a baseline). */
  delta: number;
}

/** The 3-way bloc outcome derived from the crowd's predicted bloc tallies. */
export type BlocCall = 'A' | 'B' | 'HUNG';

export interface Forecast {
  /** Count of eligible (validly submitted) picks — the hero participation figure. */
  participantCount: number;
  /**
   * Whether aggregated numbers / the bloc verdict may be shown. False below
   * REVEAL_THRESHOLD: the count stays the hero and no numbers leak. Flips true
   * once enough eligible picks accumulate.
   */
  numbersVisible: boolean;
  /**
   * Per-party trimmed averages, sorted descending by avgMandates (ties broken by
   * partyId for determinism). Null until numbersVisible (don't leak numbers early).
   */
  parties: PartyForecast[] | null;
  /** Summed trimmed averages per bloc. Null until numbersVisible. */
  blocTally: { sumA: number; sumB: number } | null;
  /** The derived 3-way bloc call (A≥61 / B≥61 / HUNG). Null until numbersVisible. */
  blocCall: BlocCall | null;
  /**
   * Predicted largest-party ids (ties allowed ⇒ may be more than one). Empty when
   * no party has a positive average. Null until numbersVisible.
   */
  largestPartyIds: string[] | null;
  /**
   * Biggest gainers vs baseline (delta > 0), most positive first. Only parties with a
   * non-null baseline are eligible. Empty when none gained. Null until numbersVisible.
   */
  biggestGainers: PartyMover[] | null;
  /**
   * Biggest losers vs baseline (delta < 0), most negative first. Only parties with a
   * non-null baseline are eligible. Empty when none lost. Null until numbersVisible.
   */
  biggestLosers: PartyMover[] | null;
}

/** How many movers to surface in each direction. */
export const MAX_MOVERS = 3;

/**
 * The Hebrew bloc-verdict headline for a derived bloc call, using the election's own
 * bloc labels (falling back to generic ones). PURE — shared by the /forecast HTML
 * hero, the og:title meta, and the OG image so all three read identically.
 */
export function blocVerdictText(
  call: BlocCall,
  blocALabel: string | null,
  blocBLabel: string | null,
): string {
  const aName = blocALabel?.trim() || 'גוש א׳';
  const bName = blocBLabel?.trim() || 'גוש ב׳';
  if (call === 'A') return `${aName} מקבל רוב`;
  if (call === 'B') return `${bName} מקבל רוב`;
  return 'אף גוש לא מקבל רוב';
}

/** Round to one decimal place (e.g. 12.34 ⇒ 12.3). */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Symmetric trimmed mean: drop ⌊frac·n⌋ values from each tail, mean the rest.
 * With n small enough that trimming would empty the set, fall back to the plain
 * mean of all values (never trim everything away). Empty input ⇒ 0.
 */
function trimmedMean(values: number[], frac: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const drop = Math.floor(sorted.length * frac);
  // If trimming both tails would leave nothing, don't trim at all.
  const kept = 2 * drop >= sorted.length ? sorted : sorted.slice(drop, sorted.length - drop);
  let sum = 0;
  for (const v of kept) sum += v;
  return sum / kept.length;
}

/**
 * Compute the forecast for one election from its stored picks and parties.
 *
 * Keep this PURE: the caller does the DB read and passes the already-loaded picks
 * + parties. Eligibility = a non-null submittedAt; sum=120 is enforced upstream.
 *
 * @param picks   all stored picks for the election (drafts + submitted, with entries).
 * @param parties the election's parties (id + bloc tag). Defaults to [] so existing
 *                count-only callers keep working.
 */
export function computeForecast(
  picks: ForecastPickInput[],
  parties: ForecastParty[] = [],
): Forecast {
  const eligible = picks.filter((p) => p.submittedAt != null);
  const participantCount = eligible.length;
  const numbersVisible = participantCount >= REVEAL_THRESHOLD;

  // Below threshold: withhold every number. The count is the hero.
  if (!numbersVisible) {
    return {
      participantCount,
      numbersVisible: false,
      parties: null,
      blocTally: null,
      blocCall: null,
      largestPartyIds: null,
      biggestGainers: null,
      biggestLosers: null,
    };
  }

  // Collect each party's predicted mandates across eligible picks. A pick missing
  // an entry for a party contributes 0 for that party (mirrors scoring: missing => 0).
  const valuesByParty = new Map<string, number[]>();
  for (const party of parties) valuesByParty.set(party.id, []);
  for (const pick of eligible) {
    const seen = new Map<string, number>();
    for (const e of pick.entries) seen.set(e.partyId, e.mandates);
    for (const party of parties) {
      valuesByParty.get(party.id)!.push(seen.get(party.id) ?? 0);
    }
  }

  // Trimmed average per party, plus the movement vs baseline. A null baseline ⇒ no
  // delta (don't invent a prior); a baseline of 0 ⇒ delta == the full forecast.
  const partyForecasts: PartyForecast[] = parties.map((party) => {
    const avgMandates = round1(trimmedMean(valuesByParty.get(party.id)!, TRIM_FRACTION));
    const baseline = party.baselineMandates;
    const delta = baseline == null ? null : round1(avgMandates - baseline);
    return { partyId: party.id, bloc: party.bloc, avgMandates, delta };
  });

  // Sort descending by average, ties broken by partyId for determinism.
  partyForecasts.sort(
    (a, b) => b.avgMandates - a.avgMandates || a.partyId.localeCompare(b.partyId),
  );

  // Bloc tally over the trimmed averages (UNALIGNED ignored, like scoring.ts).
  let sumA = 0;
  let sumB = 0;
  for (const pf of partyForecasts) {
    if (pf.bloc === 'A') sumA += pf.avgMandates;
    else if (pf.bloc === 'B') sumB += pf.avgMandates;
  }
  sumA = round1(sumA);
  sumB = round1(sumB);
  const blocCall: BlocCall = sumA >= 61 ? 'A' : sumB >= 61 ? 'B' : 'HUNG';

  // Largest-party call: every party tied at the (positive) max average.
  let maxAvg = 0;
  for (const pf of partyForecasts) if (pf.avgMandates > maxAvg) maxAvg = pf.avgMandates;
  const largestPartyIds =
    maxAvg > 0
      ? partyForecasts.filter((pf) => pf.avgMandates === maxAvg).map((pf) => pf.partyId)
      : [];

  // Biggest movers: only parties with a baseline (delta != null). Gainers (delta > 0)
  // most-positive first; losers (delta < 0) most-negative first. Ties broken by partyId
  // for determinism. Capped at MAX_MOVERS each.
  const withDelta: PartyMover[] = partyForecasts
    .filter((pf): pf is PartyForecast & { delta: number } => pf.delta != null)
    .map((pf) => ({
      partyId: pf.partyId,
      bloc: pf.bloc,
      avgMandates: pf.avgMandates,
      delta: pf.delta,
    }));
  const biggestGainers = withDelta
    .filter((m) => m.delta > 0)
    .sort((a, b) => b.delta - a.delta || a.partyId.localeCompare(b.partyId))
    .slice(0, MAX_MOVERS);
  const biggestLosers = withDelta
    .filter((m) => m.delta < 0)
    .sort((a, b) => a.delta - b.delta || a.partyId.localeCompare(b.partyId))
    .slice(0, MAX_MOVERS);

  return {
    participantCount,
    numbersVisible: true,
    parties: partyForecasts,
    blocTally: { sumA, sumB },
    blocCall,
    largestPartyIds,
    biggestGainers,
    biggestLosers,
  };
}
