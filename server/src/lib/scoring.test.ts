import { describe, it, expect } from 'vitest';
import { computeScore, type ResultParty } from './scoring';

// Helper: build a parties array.
function party(id: string, bloc: ResultParty['bloc'], actualMandates: number): ResultParty {
  return { id, bloc, actualMandates };
}

// A realistic 12-party Knesset-shaped fixture totalling 120 mandates.
// Bloc A = 64 (passes 61), Bloc B = 44, UNALIGNED = 12 (Arab parties).
const KNESSET: ResultParty[] = [
  party('likud', 'A', 32),
  party('shas', 'A', 11),
  party('yahadut', 'A', 7),
  party('otzma', 'A', 8),
  party('religiousZionism', 'A', 6),
  party('yeshAtid', 'B', 24),
  party('hamahane', 'B', 12),
  party('avoda', 'B', 4),
  party('israelBeitenu', 'B', 4),
  party('hadashTaal', 'UNALIGNED', 6),
  party('raam', 'UNALIGNED', 6),
  party('meretz', 'B', 0),
];

// sumA = 32+11+7+8+6 = 64; sumB = 24+12+4+4 = 44; UNALIGNED = 12. total = 120.

function predFromParties(parties: ResultParty[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of parties) m.set(p.id, p.actualMandates);
  return m;
}

describe('computeScore — perfect call', () => {
  it('exact prediction over a 12-party fixture: base 240, total 270', () => {
    const predicted = predFromParties(KNESSET);
    const res = computeScore(predicted, KNESSET);
    // base headline is 240; the three bonuses add 30 => total 270.
    expect(res.base).toBe(240);
    expect(res.bonusLargest).toBe(10);
    expect(res.bonusThreshold).toBe(10); // 12 correct, capped at 10
    expect(res.bonusBloc).toBe(10);
    expect(res.total).toBe(270);
  });
});

describe('computeScore — base subtraction', () => {
  it('hand-computed Σ|diff| case A', () => {
    // 3 parties, actual 60/40/20. Predict 50/50/20.
    const parties = [party('a', 'A', 60), party('b', 'B', 40), party('c', 'UNALIGNED', 20)];
    const predicted = new Map([
      ['a', 50],
      ['b', 50],
      ['c', 20],
    ]);
    // Σ|diff| = 10 + 10 + 0 = 20 => base 220.
    expect(computeScore(predicted, parties).base).toBe(220);
  });

  it('hand-computed Σ|diff| case B', () => {
    // actual 70/50, predict 4/116 => |70-4| + |50-116| = 66 + 66 = 132 => base 108.
    const parties = [party('a', 'A', 70), party('b', 'B', 50)];
    const predicted = new Map([
      ['a', 4],
      ['b', 116],
    ]);
    expect(computeScore(predicted, parties).base).toBe(108);
  });

  it('hand-computed Σ|diff| case C', () => {
    // actual 40/40/40, predict 120/0/0 => 80 + 40 + 40 = 160 => base 80.
    const parties = [party('a', 'A', 40), party('b', 'B', 40), party('c', 'UNALIGNED', 40)];
    const predicted = new Map([['a', 120]]);
    expect(computeScore(predicted, parties).base).toBe(80);
  });
});

describe('computeScore — bonusLargest', () => {
  it('correct single largest => +10', () => {
    const parties = [party('a', 'A', 60), party('b', 'B', 40), party('c', 'UNALIGNED', 20)];
    const predicted = new Map([
      ['a', 50],
      ['b', 45],
      ['c', 25],
    ]);
    expect(computeScore(predicted, parties).bonusLargest).toBe(10);
  });

  it('wrong largest => 0', () => {
    const parties = [party('a', 'A', 60), party('b', 'B', 40), party('c', 'UNALIGNED', 20)];
    const predicted = new Map([
      ['a', 30],
      ['b', 70],
      ['c', 20],
    ]);
    expect(computeScore(predicted, parties).bonusLargest).toBe(0);
  });

  it('actual tie for largest, user named one of the tied => +10', () => {
    // a and b both 50 (tied actual-largest). User predicts a as sole largest.
    const parties = [party('a', 'A', 50), party('b', 'B', 50), party('c', 'UNALIGNED', 20)];
    const predicted = new Map([
      ['a', 80],
      ['b', 20],
      ['c', 20],
    ]);
    expect(computeScore(predicted, parties).bonusLargest).toBe(10);
  });

  it("user's predicted top not among actual-largest => 0", () => {
    const parties = [party('a', 'A', 60), party('b', 'B', 40), party('c', 'UNALIGNED', 20)];
    // User's max is c, which is not the actual largest.
    const predicted = new Map([
      ['a', 30],
      ['b', 30],
      ['c', 60],
    ]);
    expect(computeScore(predicted, parties).bonusLargest).toBe(0);
  });

  it('all-zero actual => 0 (no largest)', () => {
    const parties = [party('a', 'A', 0), party('b', 'B', 0)];
    const predicted = new Map([
      ['a', 60],
      ['b', 60],
    ]);
    expect(computeScore(predicted, parties).bonusLargest).toBe(0);
  });

  it('all-zero predicted => 0 (no predicted largest)', () => {
    const parties = [party('a', 'A', 60), party('b', 'B', 60)];
    const predicted = new Map<string, number>(); // empty => all 0
    expect(computeScore(predicted, parties).bonusLargest).toBe(0);
  });

  it('tie on predicted side, one matches actual-largest => +10', () => {
    // User ties a and b at top (60 each); actual largest is a.
    const parties = [party('a', 'A', 70), party('b', 'B', 30), party('c', 'UNALIGNED', 20)];
    const predicted = new Map([
      ['a', 60],
      ['b', 60],
      ['c', 0],
    ]);
    expect(computeScore(predicted, parties).bonusLargest).toBe(10);
  });
});

describe('computeScore — bonusThreshold', () => {
  it('cap proven: 12 parties all correct => capped at 10', () => {
    const predicted = predFromParties(KNESSET);
    expect(computeScore(predicted, KNESSET).bonusThreshold).toBe(10);
  });

  it('predicting a party in (≥4) that was out (0) loses that point', () => {
    // 3 parties: actual c is out (0). Predict c at 4 => loses c's point.
    const parties = [party('a', 'A', 60), party('b', 'B', 60), party('c', 'UNALIGNED', 0)];
    const predicted = new Map([
      ['a', 58],
      ['b', 58],
      ['c', 4],
    ]);
    // a: both in (+1), b: both in (+1), c: predicted in but actual out (0). => 2.
    expect(computeScore(predicted, parties).bonusThreshold).toBe(2);
  });

  it('mixed partial count', () => {
    // 5 parties: in/out per party.
    const parties = [
      party('a', 'A', 50), // actual in
      party('b', 'B', 0), // actual out
      party('c', 'UNALIGNED', 5), // actual in
      party('d', 'A', 0), // actual out
      party('e', 'B', 65), // actual in
    ];
    const predicted = new Map([
      ['a', 40], // in  vs in  => +1
      ['b', 4], // in  vs out => 0
      ['c', 0], // out vs in  => 0
      ['d', 0], // out vs out => +1
      ['e', 76], // in  vs in  => +1
    ]);
    expect(computeScore(predicted, parties).bonusThreshold).toBe(3);
  });
});

describe('computeScore — bonusBloc', () => {
  it('A ≥ 61 matched => +10', () => {
    // Actual A wins (sumA 70). Prediction also has A winning (sumA 65).
    const parties = [party('a', 'A', 70), party('b', 'B', 50)];
    const predicted = new Map([
      ['a', 65],
      ['b', 55],
    ]);
    expect(computeScore(predicted, parties).bonusBloc).toBe(10);
  });

  it('B ≥ 61 matched => +10', () => {
    const parties = [party('a', 'A', 40), party('b', 'B', 80)];
    const predicted = new Map([
      ['a', 50],
      ['b', 70],
    ]);
    expect(computeScore(predicted, parties).bonusBloc).toBe(10);
  });

  it('HUNG matched => +10', () => {
    // Neither bloc reaches 61 actual (A 50, B 50, UNALIGNED 20).
    const parties = [party('a', 'A', 50), party('b', 'B', 50), party('c', 'UNALIGNED', 20)];
    const predicted = new Map([
      ['a', 55],
      ['b', 45],
      ['c', 20],
    ]); // predicted A 55, B 45 => HUNG too
    expect(computeScore(predicted, parties).bonusBloc).toBe(10);
  });

  it('wrong call => 0', () => {
    // Actual A wins (70). User predicts B winning.
    const parties = [party('a', 'A', 70), party('b', 'B', 50)];
    const predicted = new Map([
      ['a', 40],
      ['b', 80],
    ]);
    expect(computeScore(predicted, parties).bonusBloc).toBe(0);
  });

  it('UNALIGNED mandates do not tip a bloc', () => {
    // A 55, B 40, UNALIGNED 25 => HUNG (UNALIGNED ignored, A < 61).
    const parties = [party('a', 'A', 55), party('b', 'B', 40), party('c', 'UNALIGNED', 25)];
    // Prediction: A 60, B 35, UNALIGNED 25 => still HUNG. Matches => +10.
    const predicted = new Map([
      ['a', 60],
      ['b', 35],
      ['c', 25],
    ]);
    const res = computeScore(predicted, parties);
    expect(res.bonusBloc).toBe(10);

    // Now make UNALIGNED huge enough that if it counted, a bloc would flip —
    // it must NOT. A 55, UNALIGNED 65 actual => still HUNG (A 55 < 61).
    const parties2 = [party('a', 'A', 55), party('b', 'B', 0), party('c', 'UNALIGNED', 65)];
    const predicted2 = new Map([
      ['a', 70], // predicted A wins => 'A'
      ['b', 0],
      ['c', 50],
    ]);
    // actual call = HUNG, predicted call = A => mismatch => 0.
    expect(computeScore(predicted2, parties2).bonusBloc).toBe(0);
  });
});

describe('computeScore — combined realistic mixed pick (fully hand-computed)', () => {
  it('matches the hand-computed ScoreBreakdown', () => {
    // 5-party fixture, actual totals 120:
    //   likud A 40, yeshAtid B 30, shas A 25, raam UNALIGNED 15, avoda B 10
    // sumA = 65 (>=61 => 'A'), sumB = 40.
    const parties = [
      party('likud', 'A', 40),
      party('yeshAtid', 'B', 30),
      party('shas', 'A', 25),
      party('raam', 'UNALIGNED', 15),
      party('avoda', 'B', 10),
    ];
    // Prediction (totals 120):
    //   likud 45, yeshAtid 25, shas 20, raam 0, avoda 30
    const predicted = new Map([
      ['likud', 45],
      ['yeshAtid', 25],
      ['shas', 20],
      ['raam', 0],
      ['avoda', 30],
    ]);

    // base: Σ|diff| = |45-40| + |25-30| + |20-25| + |0-15| + |30-10|
    //              = 5 + 5 + 5 + 15 + 20 = 50 => base 190.
    // bonusLargest: actual max likud(40); predicted max likud(45) => +10.
    // bonusThreshold: per party (≥4 in both?):
    //   likud in/in +1, yeshAtid in/in +1, shas in/in +1,
    //   raam predicted out(0) / actual in(15) => 0,
    //   avoda in/in +1  => 4.
    // bonusBloc: actual sumA=65 => 'A'. predicted sumA = 45+20 = 65 => 'A'. Match => +10.
    // total = 190 + 10 + 4 + 10 = 214.
    const res = computeScore(predicted, parties);
    expect(res).toEqual({
      base: 190,
      bonusLargest: 10,
      bonusThreshold: 4,
      bonusBloc: 10,
      total: 214,
    });
  });
});

describe('computeScore — edge cases', () => {
  it('empty predicted Map => base = 240 − Σactual, all predicted treated as 0', () => {
    const parties = [party('a', 'A', 60), party('b', 'B', 40), party('c', 'UNALIGNED', 20)];
    // Σ|0 - actual| = 120 => base 120.
    const res = computeScore(new Map(), parties);
    expect(res.base).toBe(120);
    expect(res.bonusLargest).toBe(0); // predictedMax 0 => no award
    // threshold: every party actual in (≥4), predicted out => 0 matches => 0.
    expect(res.bonusThreshold).toBe(0);
    // predicted call: all 0 => HUNG; actual: A 60 < 61, B 40 => HUNG => match +10.
    expect(res.bonusBloc).toBe(10);
  });

  it('predicted missing some parties are treated as 0', () => {
    const parties = [party('a', 'A', 50), party('b', 'B', 40), party('c', 'UNALIGNED', 30)];
    // Only predict a; b and c default to 0.
    const predicted = new Map([['a', 50]]);
    // Σ|diff| = 0 + 40 + 30 = 70 => base 170.
    expect(computeScore(predicted, parties).base).toBe(170);
  });

  it('empty parties array => base 240, largest/threshold 0; bloc HUNG===HUNG => +10', () => {
    // No parties: nothing to subtract (base 240), no largest, no threshold.
    // Both bloc calls are HUNG (sumA=0, sumB=0), and HUNG === HUNG, so per the
    // spec (award IFF predictedCall === actualCall) bonusBloc is +10.
    const res = computeScore(new Map([['ghost', 50]]), []);
    expect(res).toEqual({
      base: 240,
      bonusLargest: 0,
      bonusThreshold: 0,
      bonusBloc: 10,
      total: 250,
    });
  });
});
