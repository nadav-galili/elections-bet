import { describe, it, expect } from 'vitest';
import { computeForecast, type ForecastPickInput } from './forecast';

// Helper: build a pick input with a given submittedAt (defaults to submitted).
function pick(submittedAt: Date | null = new Date('2026-01-01T00:00:00Z')): ForecastPickInput {
  return { submittedAt };
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
    // 2 submitted + 2 drafts ⇒ only the 2 submitted count.
    const res = computeForecast([pick(), pick(null), pick(), pick(null)]);
    expect(res.participantCount).toBe(2);
  });

  it('counts 0 when every pick is a draft', () => {
    const res = computeForecast([pick(null), pick(null)]);
    expect(res.participantCount).toBe(0);
  });
});

describe('computeForecast — numbersVisible', () => {
  it('is always false in this slice (count is the hero, no numbers leak)', () => {
    expect(computeForecast([]).numbersVisible).toBe(false);
    expect(computeForecast([pick(), pick()]).numbersVisible).toBe(false);
  });
});
