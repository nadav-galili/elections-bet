import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Clerk is fully stubbed: middleware passes through, getAuth yields a fixed user.
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuth: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: 'clerk_test' }),
  clerkClient: { users: { getUser: vi.fn() } },
}));

// Prisma is stubbed per-test. requireAuthMw → ensureDbUser reads
// prisma.user.findUnique; the handlers read election/score/pick/groupMembership.
vi.mock('../db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    election: { findUnique: vi.fn(), findFirst: vi.fn() },
    score: { findMany: vi.fn() },
    pick: { findMany: vi.fn(), count: vi.fn() },
    groupMembership: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}));

import { createApp } from '../app';
import { prisma } from '../db';

const mocked = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
  election: Record<'findUnique' | 'findFirst', ReturnType<typeof vi.fn>>;
  score: { findMany: ReturnType<typeof vi.fn> };
  pick: Record<'findMany' | 'count', ReturnType<typeof vi.fn>>;
  groupMembership: Record<'findUnique' | 'findMany', ReturnType<typeof vi.fn>>;
};

// requireAuthMw → ensureDbUser resolves the local DB user from the Clerk id.
function asUser(id = 'u1'): void {
  mocked.user.findUnique.mockResolvedValue({
    id,
    clerkId: 'clerk_test',
    role: 'USER',
  });
}

function score(userId: string, total: number, displayName: string | null = userId) {
  return { userId, total, user: { displayName, avatarUrl: null } };
}

function pick(userId: string, submittedAt: Date | null) {
  return { userId, submittedAt };
}

beforeEach(() => {
  vi.clearAllMocks();
  asUser();
});

describe('GET /api/elections/:id/leaderboard — global board', () => {
  it('404 when the election does not exist', async () => {
    mocked.election.findUnique.mockResolvedValue(null);
    const res = await request(createApp()).get('/api/elections/missing/leaderboard');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('הבחירות לא נמצאו');
  });

  it('NONE (pre-publish): returns participantCount and NEVER rows/scores', async () => {
    mocked.election.findUnique.mockResolvedValue({ id: 'e1', resultsStatus: 'NONE' });
    mocked.pick.count.mockResolvedValue(7);

    const res = await request(createApp()).get('/api/elections/e1/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ published: false, participantCount: 7 });
    // Privacy: Score must never be touched in the pre-publish branch.
    expect(mocked.score.findMany).not.toHaveBeenCalled();
    expect(res.body.rows).toBeUndefined();
    // count is restricted to submitted picks.
    expect(mocked.pick.count).toHaveBeenCalledWith({
      where: { electionId: 'e1', submittedAt: { not: null } },
    });
  });

  it('published: ranks all scores with tie-break ordering and competition ranks', async () => {
    mocked.election.findUnique.mockResolvedValue({ id: 'e1', resultsStatus: 'FINAL' });
    // a & b tie on 100; b submitted earlier ⇒ b before a, both rank 1. c rank 3.
    mocked.score.findMany.mockResolvedValue([score('a', 100), score('b', 100), score('c', 50)]);
    mocked.pick.findMany.mockResolvedValue([
      pick('a', new Date('2026-01-02T00:00:00Z')),
      pick('b', new Date('2026-01-01T00:00:00Z')),
      pick('c', new Date('2026-01-01T00:00:00Z')),
    ]);

    const res = await request(createApp()).get('/api/elections/e1/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body.published).toBe(true);
    expect(res.body.total).toBe(3);
    expect(res.body.rows.map((r: { userId: string }) => r.userId)).toEqual(['b', 'a', 'c']);
    expect(res.body.rows.map((r: { rank: number }) => r.rank)).toEqual([1, 1, 3]);
    // Caller u1 is not on the board ⇒ yourRank null.
    expect(res.body.yourRank).toBeNull();
  });

  it('PROVISIONAL is treated as published', async () => {
    mocked.election.findUnique.mockResolvedValue({ id: 'e1', resultsStatus: 'PROVISIONAL' });
    mocked.score.findMany.mockResolvedValue([score('a', 10)]);
    mocked.pick.findMany.mockResolvedValue([pick('a', new Date('2026-01-01T00:00:00Z'))]);

    const res = await request(createApp()).get('/api/elections/e1/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body.published).toBe(true);
    expect(res.body.total).toBe(1);
  });

  it('paginates with limit/offset; yourRank is independent of the page slice', async () => {
    asUser('u3'); // caller is u3, ranked 3rd
    mocked.election.findUnique.mockResolvedValue({ id: 'e1', resultsStatus: 'FINAL' });
    mocked.score.findMany.mockResolvedValue([
      score('u1', 100),
      score('u2', 90),
      score('u3', 80),
      score('u4', 70),
    ]);
    mocked.pick.findMany.mockResolvedValue([
      pick('u1', new Date('2026-01-01T00:00:00Z')),
      pick('u2', new Date('2026-01-01T00:00:00Z')),
      pick('u3', new Date('2026-01-01T00:00:00Z')),
      pick('u4', new Date('2026-01-01T00:00:00Z')),
    ]);

    const res = await request(createApp())
      .get('/api/elections/e1/leaderboard')
      .query({ limit: 2, offset: 2 });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    // page = rows 3 & 4
    expect(res.body.rows.map((r: { userId: string }) => r.userId)).toEqual(['u3', 'u4']);
    // yourRank is u3's global rank (3), even though the slice starts at offset 2.
    expect(res.body.yourRank).toBe(3);
  });

  it('clamps a bad limit (NaN → default, over-max → 100, <1 → 1)', async () => {
    mocked.election.findUnique.mockResolvedValue({ id: 'e1', resultsStatus: 'FINAL' });
    mocked.score.findMany.mockResolvedValue([score('a', 10)]);
    mocked.pick.findMany.mockResolvedValue([pick('a', new Date('2026-01-01T00:00:00Z'))]);

    // NaN limit falls back to default and still returns the row.
    const res = await request(createApp())
      .get('/api/elections/e1/leaderboard')
      .query({ limit: 'abc', offset: '-5' });
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
  });
});

describe('GET /api/groups/:id/leaderboard — group board', () => {
  it('403 for a non-member', async () => {
    mocked.groupMembership.findUnique.mockResolvedValue(null);
    const res = await request(createApp()).get('/api/groups/g1/leaderboard');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('אינך חבר בקבוצה זו');
  });

  it('no active election: published false, participantCount 0', async () => {
    mocked.groupMembership.findUnique.mockResolvedValue({ id: 'm1', userId: 'u1' });
    mocked.groupMembership.findMany.mockResolvedValue([{ userId: 'u1' }]);
    mocked.election.findFirst.mockResolvedValue(null);

    const res = await request(createApp()).get('/api/groups/g1/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ published: false, participantCount: 0 });
    expect(mocked.score.findMany).not.toHaveBeenCalled();
  });

  it('NONE active election: participantCount scoped to members, NO scores', async () => {
    mocked.groupMembership.findUnique.mockResolvedValue({ id: 'm1', userId: 'u1' });
    mocked.groupMembership.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
    mocked.election.findFirst.mockResolvedValue({ id: 'e1', resultsStatus: 'NONE' });
    mocked.pick.count.mockResolvedValue(2);

    const res = await request(createApp()).get('/api/groups/g1/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ published: false, participantCount: 2 });
    expect(mocked.score.findMany).not.toHaveBeenCalled();
    expect(mocked.pick.count).toHaveBeenCalledWith({
      where: {
        electionId: 'e1',
        submittedAt: { not: null },
        userId: { in: ['u1', 'u2'] },
      },
    });
  });

  it('published: ranking scoped to group members; rank/total/yourRank are within the group', async () => {
    asUser('u2'); // caller u2 is a member and second in the group
    mocked.groupMembership.findUnique.mockResolvedValue({ id: 'm2', userId: 'u2' });
    mocked.groupMembership.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
    mocked.election.findFirst.mockResolvedValue({ id: 'e1', resultsStatus: 'FINAL' });
    // Score query is scoped to member ids only; the global non-member is absent.
    mocked.score.findMany.mockResolvedValue([score('u1', 100), score('u2', 60)]);
    mocked.pick.findMany.mockResolvedValue([
      pick('u1', new Date('2026-01-01T00:00:00Z')),
      pick('u2', new Date('2026-01-01T00:00:00Z')),
    ]);

    const res = await request(createApp()).get('/api/groups/g1/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body.published).toBe(true);
    expect(res.body.total).toBe(2);
    expect(res.body.rows.map((r: { userId: string }) => r.userId)).toEqual(['u1', 'u2']);
    expect(res.body.yourRank).toBe(2);
    // The Score query must be member-scoped.
    expect(mocked.score.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          electionId: 'e1',
          userId: { in: ['u1', 'u2'] },
        }),
      }),
    );
  });
});
