// Scoring engine — PURE function, no DB / no I/O.
//
// This is the heart of the game (implementation-plan.md §1). Given a user's
// predicted mandate split and the actual election results (with bloc tags),
// it produces a deterministic ScoreBreakdown.
//
// A "perfect call" headline is 240 — that refers to the BASE component only
// (base === 240 when every prediction is exact). With ≥10 parties a perfect
// call also nails the three bonuses, so TOTAL === 270 (base 240 + 30 bonuses).
// Do not confuse base (max 240) with total (max 270 in practice).

export type Bloc = 'A' | 'B' | 'UNALIGNED';

export interface ResultParty {
  id: string;
  bloc: Bloc;
  /** Actual mandates won: 0 or an integer 4..120 (same rule as predictions). */
  actualMandates: number;
}

export interface ScoreBreakdown {
  base: number;
  bonusLargest: number;
  bonusThreshold: number;
  bonusBloc: number;
  total: number;
}

type BlocCall = 'A' | 'B' | 'HUNG';

/**
 * Determine which bloc holds a majority for a given mandate lookup.
 * sumA = Σ mandates of bloc 'A' parties, sumB = Σ of bloc 'B' parties.
 * 'UNALIGNED' parties are ignored. A and B can't both reach 61 (total ≤ 120).
 */
function blocCall(parties: ResultParty[], mandatesOf: (p: ResultParty) => number): BlocCall {
  let sumA = 0;
  let sumB = 0;
  for (const p of parties) {
    if (p.bloc === 'A') sumA += mandatesOf(p);
    else if (p.bloc === 'B') sumB += mandatesOf(p);
  }
  if (sumA >= 61) return 'A';
  if (sumB >= 61) return 'B';
  return 'HUNG';
}

/**
 * Compute the score breakdown for one prediction against actual results.
 *
 * @param predicted partyId -> predicted mandates (0 or 4..120). Missing => 0.
 * @param parties   actual results + bloc tags. This is the source of truth:
 *                  we iterate over it, not over the predicted Map.
 */
export function computeScore(
  predicted: Map<string, number>,
  parties: ResultParty[],
): ScoreBreakdown {
  const predictedOf = (p: ResultParty): number => predicted.get(p.id) ?? 0;

  // --- base ---------------------------------------------------------------
  // base = 240 − Σ |predictedOf − actualMandates|.
  // For valid inputs (both sums = 120) the total absolute error is ≤ 240, so
  // base ∈ [0, 240] and CANNOT go negative. We intentionally do not clamp.
  let totalAbsError = 0;
  for (const p of parties) {
    totalAbsError += Math.abs(predictedOf(p) - p.actualMandates);
  }
  const base = 240 - totalAbsError;

  // --- bonusLargest (+10 or 0) -------------------------------------------
  // Award +10 IFF the set of predicted-largest ids intersects the set of
  // actual-largest ids. Ties on EITHER side count: naming any tied-largest
  // wins. If either max is 0, no award.
  let actualMax = 0;
  let predictedMax = 0;
  for (const p of parties) {
    if (p.actualMandates > actualMax) actualMax = p.actualMandates;
    const pred = predictedOf(p);
    if (pred > predictedMax) predictedMax = pred;
  }
  let bonusLargest = 0;
  if (actualMax > 0 && predictedMax > 0) {
    const intersects = parties.some(
      (p) => p.actualMandates === actualMax && predictedOf(p) === predictedMax,
    );
    if (intersects) bonusLargest = 10;
  }

  // --- bonusThreshold (+1 per party, capped at +10) ----------------------
  // For each party: predictedIn = predicted ≥ 4, actualIn = actual ≥ 4.
  // +1 when predictedIn === actualIn (both in, or both out). Cap at 10.
  let thresholdCount = 0;
  for (const p of parties) {
    const predictedIn = predictedOf(p) >= 4;
    const actualIn = p.actualMandates >= 4;
    if (predictedIn === actualIn) thresholdCount += 1;
  }
  const bonusThreshold = Math.min(10, thresholdCount);

  // --- bonusBloc (+10 or 0) ----------------------------------------------
  // Award +10 IFF the bloc call from the prediction matches the call from
  // the actual results.
  const predictedCall = blocCall(parties, predictedOf);
  const actualCall = blocCall(parties, (p) => p.actualMandates);
  const bonusBloc = predictedCall === actualCall ? 10 : 0;

  const total = base + bonusLargest + bonusThreshold + bonusBloc;

  return { base, bonusLargest, bonusThreshold, bonusBloc, total };
}
