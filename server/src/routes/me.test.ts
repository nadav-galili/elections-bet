import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Clerk is fully stubbed: middleware passes through, getAuth yields a fixed user.
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuth: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: 'clerk_test' }),
  clerkClient: { users: { getUser: vi.fn() } },
}));

// requireAuthMw → ensureDbUser reads prisma.user.findUnique; PATCH calls update.
vi.mock('../db', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { createApp } from '../app';
import { prisma } from '../db';

const mocked = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocked.user.findUnique.mockResolvedValue({
    id: 'u1',
    clerkId: 'clerk_test',
    role: 'USER',
    displayName: 'נדב',
    avatarUrl: null,
  });
});

describe('GET /api/me', () => {
  it('returns the profile shape for a signed-in user', async () => {
    const res = await request(createApp()).get('/api/me');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 'u1',
      role: 'USER',
      displayName: 'נדב',
      avatarUrl: null,
    });
  });

  it('403 for a banned user', async () => {
    mocked.user.findUnique.mockResolvedValue({
      id: 'u1',
      clerkId: 'clerk_test',
      role: 'USER',
      displayName: 'נדב',
      avatarUrl: null,
      bannedAt: new Date('2026-06-01T00:00:00.000Z'),
    });
    const res = await request(createApp()).get('/api/me');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('חשבונך הושעה');
  });
});

describe('PATCH /api/me', () => {
  it('updates displayName and returns the profile shape', async () => {
    mocked.user.update.mockResolvedValue({
      id: 'u1',
      role: 'USER',
      displayName: 'שם חדש',
      avatarUrl: 'http://x/a.png',
    });

    const res = await request(createApp()).patch('/api/me').send({ displayName: 'שם חדש' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 'u1',
      role: 'USER',
      displayName: 'שם חדש',
      avatarUrl: 'http://x/a.png',
    });
    expect(mocked.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { displayName: 'שם חדש' },
    });
  });

  it('trims surrounding whitespace before saving', async () => {
    mocked.user.update.mockResolvedValue({
      id: 'u1',
      role: 'USER',
      displayName: 'נדב',
      avatarUrl: null,
    });
    await request(createApp()).patch('/api/me').send({ displayName: '  נדב  ' });
    expect(mocked.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { displayName: 'נדב' },
    });
  });

  it('400 on an empty displayName', async () => {
    const res = await request(createApp()).patch('/api/me').send({ displayName: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('שגיאת אימות');
    expect(Array.isArray(res.body.issues)).toBe(true);
    expect(mocked.user.update).not.toHaveBeenCalled();
  });

  it('400 when displayName exceeds the 50-char limit', async () => {
    const res = await request(createApp())
      .patch('/api/me')
      .send({ displayName: 'א'.repeat(51) });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('שגיאת אימות');
    expect(mocked.user.update).not.toHaveBeenCalled();
  });
});
