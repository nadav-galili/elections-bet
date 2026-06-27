import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Clerk is fully stubbed: middleware passes through, getAuth yields a fixed user.
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuth: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: 'clerk_test' }),
  clerkClient: { users: { getUser: vi.fn() } },
}));

// Prisma is stubbed per-test. pick/pickEntry are shared so the $transaction
// callback receives the same mock fns it asserts against.
vi.mock('../db', () => {
  const pick = { findUnique: vi.fn(), upsert: vi.fn() };
  const pickEntry = { deleteMany: vi.fn(), createMany: vi.fn() };
  return {
    prisma: {
      user: { findUnique: vi.fn() },
      election: { findMany: vi.fn(), findUnique: vi.fn() },
      pick,
      pickEntry,
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({ pick, pickEntry })),
    },
  };
});

import { createApp } from '../app';
import { prisma } from '../db';

const mocked = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
  election: Record<'findMany' | 'findUnique', ReturnType<typeof vi.fn>>;
  pick: Record<'findUnique' | 'upsert', ReturnType<typeof vi.fn>>;
  pickEntry: Record<'deleteMany' | 'createMany', ReturnType<typeof vi.fn>>;
  $transaction: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  // ensureDbUser resolves a local USER row without touching clerkClient.
  mocked.user.findUnique.mockResolvedValue({ id: 'u1', clerkId: 'clerk_test', role: 'USER' });
});

describe('GET /api/elections/:id/pick', () => {
  it('returns null when the user has no pick', async () => {
    mocked.pick.findUnique.mockResolvedValue(null);
    const res = await request(createApp()).get('/api/elections/e1/pick');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

describe('PUT /api/elections/:id/pick', () => {
  it('creates a pick (201)', async () => {
    mocked.election.findUnique.mockResolvedValue({
      id: 'e1',
      lockAt: null,
      parties: [{ id: 'p1' }, { id: 'p2' }],
    });
    mocked.pick.findUnique.mockResolvedValue(null);
    mocked.pick.upsert.mockResolvedValue({ id: 'pick1' });
    mocked.pickEntry.deleteMany.mockResolvedValue({ count: 0 });
    mocked.pickEntry.createMany.mockResolvedValue({ count: 2 });

    const res = await request(createApp())
      .put('/api/elections/e1/pick')
      .send({
        entries: [
          { partyId: 'p1', mandates: 60 },
          { partyId: 'p2', mandates: 60 },
        ],
      });

    expect(res.status).toBe(201);
    expect(mocked.pickEntry.createMany).toHaveBeenCalledOnce();
  });

  it('replaces an existing pick (200)', async () => {
    mocked.election.findUnique.mockResolvedValue({
      id: 'e1',
      lockAt: null,
      parties: [{ id: 'p1' }, { id: 'p2' }],
    });
    mocked.pick.findUnique.mockResolvedValue({ id: 'pick1' });
    mocked.pick.upsert.mockResolvedValue({ id: 'pick1' });
    mocked.pickEntry.deleteMany.mockResolvedValue({ count: 2 });
    mocked.pickEntry.createMany.mockResolvedValue({ count: 2 });

    const res = await request(createApp())
      .put('/api/elections/e1/pick')
      .send({
        entries: [
          { partyId: 'p1', mandates: 60 },
          { partyId: 'p2', mandates: 60 },
        ],
      });

    expect(res.status).toBe(200);
  });

  it('returns 409 once the election is locked', async () => {
    mocked.election.findUnique.mockResolvedValue({
      id: 'e1',
      lockAt: new Date('2020-01-01T20:00:00.000Z'),
      parties: [{ id: 'p1' }, { id: 'p2' }],
    });

    const res = await request(createApp())
      .put('/api/elections/e1/pick')
      .send({
        entries: [
          { partyId: 'p1', mandates: 60 },
          { partyId: 'p2', mandates: 60 },
        ],
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('התחזיות ננעלו');
  });

  it('returns 400 for an invalid body (mandates of 2)', async () => {
    const res = await request(createApp())
      .put('/api/elections/e1/pick')
      .send({
        entries: [
          { partyId: 'p1', mandates: 2 },
          { partyId: 'p2', mandates: 118 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('שגיאת אימות');
  });

  it('returns 400 when the party set does not match the election', async () => {
    mocked.election.findUnique.mockResolvedValue({
      id: 'e1',
      lockAt: null,
      parties: [{ id: 'p1' }, { id: 'p2' }],
    });
    mocked.pick.findUnique.mockResolvedValue(null);

    const res = await request(createApp())
      .put('/api/elections/e1/pick')
      .send({
        entries: [{ partyId: 'p1', mandates: 120 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('התחזית חייבת לכלול את כל המפלגות בבחירות');
  });
});

describe('banned players are locked out of the pick routes', () => {
  beforeEach(() => {
    // A super-admin ban is a reversible flag on the user row.
    mocked.user.findUnique.mockResolvedValue({
      id: 'u1',
      clerkId: 'clerk_test',
      role: 'USER',
      bannedAt: new Date('2026-06-01T00:00:00.000Z'),
    });
  });

  it('403 on GET /api/elections/:id/pick', async () => {
    const res = await request(createApp()).get('/api/elections/e1/pick');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('חשבונך הושעה');
  });

  it('403 on PUT /api/elections/:id/pick (cannot submit a prediction)', async () => {
    const res = await request(createApp())
      .put('/api/elections/e1/pick')
      .send({
        entries: [
          { partyId: 'p1', mandates: 60 },
          { partyId: 'p2', mandates: 60 },
        ],
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('חשבונך הושעה');
    expect(mocked.pick.upsert).not.toHaveBeenCalled();
  });
});
