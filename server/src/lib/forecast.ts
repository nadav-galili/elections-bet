// Forecast aggregation — PURE function, no DB / no I/O.
//
// This is the seam the public /forecast page is built on (implementation-plan.md:
// "a game, not a poll"). Given the set of stored picks for an election, it derives
// the participation figure and whether real numbers may be shown yet.
//
// This slice (forecast slice 1, tracer bullet) deliberately keeps the output thin:
// just the eligible-pick participation count, plus `numbersVisible=false`. The
// page's default state is "count as hero" — the aggregated mandate numbers and the
// bloc verdict are added in a later slice, gated by `numbersVisible`.

/** The minimal shape of a stored pick we need to judge eligibility. */
export interface ForecastPickInput {
  /**
   * When the pick was submitted, or null for a draft. Only submitted picks count
   * toward participation. Stored picks already satisfy the sum=120 invariant, so
   * submittedAt is the one thing we filter on defensively here.
   */
  submittedAt: Date | null;
}

export interface Forecast {
  /** Count of eligible (validly submitted) picks — the hero participation figure. */
  participantCount: number;
  /**
   * Whether aggregated numbers / the bloc verdict may be shown. Always false in
   * this slice: below the reveal threshold, the count is the hero and no numbers
   * leak. A later slice flips this on once enough picks accumulate.
   */
  numbersVisible: boolean;
}

/**
 * Compute the forecast for one election from its stored picks.
 *
 * @param picks all stored picks for the election (drafts + submitted). Eligibility
 *              = a non-null submittedAt; everything else (sum=120) is enforced
 *              upstream at write time.
 */
export function computeForecast(picks: ForecastPickInput[]): Forecast {
  let participantCount = 0;
  for (const p of picks) {
    if (p.submittedAt != null) participantCount += 1;
  }
  return { participantCount, numbersVisible: false };
}
