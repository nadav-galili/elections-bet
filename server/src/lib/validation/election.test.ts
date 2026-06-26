import { describe, it, expect } from 'vitest';
import {
  createElectionSchema,
  updateElectionSchema,
  createPartySchema,
  updatePartySchema,
} from './election';

describe('createElectionSchema', () => {
  it('requires nameHe', () => {
    const res = createElectionSchema.safeParse({ nameHe: '' });
    expect(res.success).toBe(false);
  });

  it('trims and accepts a valid nameHe', () => {
    const res = createElectionSchema.safeParse({ nameHe: '  בחירות 2026  ' });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.nameHe).toBe('בחירות 2026');
  });

  it('rejects revealAt before lockAt', () => {
    const res = createElectionSchema.safeParse({
      nameHe: 'x',
      lockAt: '2026-01-01T20:00:00.000Z',
      revealAt: '2026-01-01T19:00:00.000Z',
    });
    expect(res.success).toBe(false);
  });

  it('accepts revealAt equal to or after lockAt and coerces to Date', () => {
    const res = createElectionSchema.safeParse({
      nameHe: 'x',
      lockAt: '2026-01-01T20:00:00.000Z',
      revealAt: '2026-01-01T20:02:00.000Z',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.lockAt).toBeInstanceOf(Date);
      expect(res.data.revealAt).toBeInstanceOf(Date);
    }
  });

  it('allows nullable bloc labels and dates', () => {
    const res = createElectionSchema.safeParse({
      nameHe: 'x',
      lockAt: null,
      revealAt: null,
      blocALabel: null,
      blocBLabel: null,
    });
    expect(res.success).toBe(true);
  });
});

describe('updateElectionSchema', () => {
  it('allows an empty partial update', () => {
    const res = updateElectionSchema.safeParse({});
    expect(res.success).toBe(true);
  });

  it('allows a subset of fields', () => {
    const res = updateElectionSchema.safeParse({ blocALabel: 'גוש ימין' });
    expect(res.success).toBe(true);
  });

  it('still enforces revealAt >= lockAt when both present', () => {
    const res = updateElectionSchema.safeParse({
      lockAt: '2026-01-01T20:00:00.000Z',
      revealAt: '2026-01-01T18:00:00.000Z',
    });
    expect(res.success).toBe(false);
  });
});

describe('createPartySchema', () => {
  it('requires nameHe', () => {
    expect(createPartySchema.safeParse({ nameHe: '' }).success).toBe(false);
  });

  it('rejects a junk bloc value', () => {
    const res = createPartySchema.safeParse({ nameHe: 'ליכוד', bloc: 'C' });
    expect(res.success).toBe(false);
  });

  it("transforms logoUrl '' -> null", () => {
    const res = createPartySchema.safeParse({ nameHe: 'ליכוד', logoUrl: '' });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.logoUrl).toBeNull();
  });

  it('accepts a valid logoUrl', () => {
    const res = createPartySchema.safeParse({
      nameHe: 'ליכוד',
      logoUrl: 'https://example.com/logo.png',
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.logoUrl).toBe('https://example.com/logo.png');
  });

  it('rejects an invalid logoUrl', () => {
    const res = createPartySchema.safeParse({ nameHe: 'ליכוד', logoUrl: 'not-a-url' });
    expect(res.success).toBe(false);
  });

  it('defaults bloc and displayOrder', () => {
    const res = createPartySchema.safeParse({ nameHe: 'ליכוד' });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.bloc).toBe('UNALIGNED');
      expect(res.data.displayOrder).toBe(0);
    }
  });
});

describe('updatePartySchema', () => {
  it('allows a subset of fields', () => {
    const res = updatePartySchema.safeParse({ displayOrder: 3 });
    expect(res.success).toBe(true);
  });

  it('rejects a junk bloc value', () => {
    expect(updatePartySchema.safeParse({ bloc: 'X' }).success).toBe(false);
  });
});
