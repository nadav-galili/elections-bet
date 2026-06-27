import { describe, it, expect } from 'vitest';
import { upsertPickSchema } from './pick';

describe('upsertPickSchema', () => {
  it('rejects mandates of 1, 2, and 3', () => {
    for (const bad of [1, 2, 3]) {
      const res = upsertPickSchema.safeParse({
        entries: [
          { partyId: 'p1', mandates: bad },
          { partyId: 'p2', mandates: 120 - bad },
        ],
      });
      expect(res.success).toBe(false);
    }
  });

  it('rejects a sum that is not exactly 120', () => {
    const res = upsertPickSchema.safeParse({
      entries: [
        { partyId: 'p1', mandates: 60 },
        { partyId: 'p2', mandates: 50 },
      ],
    });
    expect(res.success).toBe(false);
  });

  it('accepts 0 and values in 4..120 that total exactly 120', () => {
    const res = upsertPickSchema.safeParse({
      entries: [
        { partyId: 'p1', mandates: 0 },
        { partyId: 'p2', mandates: 4 },
        { partyId: 'p3', mandates: 116 },
      ],
    });
    expect(res.success).toBe(true);
  });

  it('rejects a duplicate partyId', () => {
    const res = upsertPickSchema.safeParse({
      entries: [
        { partyId: 'p1', mandates: 60 },
        { partyId: 'p1', mandates: 60 },
      ],
    });
    expect(res.success).toBe(false);
  });

  it('rejects an empty entries array', () => {
    const res = upsertPickSchema.safeParse({ entries: [] });
    expect(res.success).toBe(false);
  });
});
