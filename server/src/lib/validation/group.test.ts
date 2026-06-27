import { describe, it, expect } from 'vitest';
import { createGroupSchema, updateGroupSchema } from './group';

describe('createGroupSchema', () => {
  it('rejects an empty nameHe', () => {
    const res = createGroupSchema.safeParse({ nameHe: '' });
    expect(res.success).toBe(false);
  });

  it('trims and accepts a valid nameHe', () => {
    const res = createGroupSchema.safeParse({ nameHe: '  החבר׳ה  ' });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.nameHe).toBe('החבר׳ה');
  });
});

describe('updateGroupSchema', () => {
  it('rejects an empty (no-op) update', () => {
    const res = updateGroupSchema.safeParse({});
    expect(res.success).toBe(false);
  });

  it('accepts a single field (rename only)', () => {
    const res = updateGroupSchema.safeParse({ nameHe: 'שם חדש' });
    expect(res.success).toBe(true);
  });

  it('rejects a non-cuid adminUserId on transfer', () => {
    const res = updateGroupSchema.safeParse({ adminUserId: 'not-a-cuid' });
    expect(res.success).toBe(false);
  });

  it('accepts a valid cuid adminUserId on transfer', () => {
    const res = updateGroupSchema.safeParse({
      adminUserId: 'clh1234567890abcdefghijkl',
    });
    expect(res.success).toBe(true);
  });
});
