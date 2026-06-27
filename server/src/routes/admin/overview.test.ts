import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Clerk is fully stubbed: middleware passes through, getAuth yields a fixed user.
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuth: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: 'clerk_test' }),
  clerkClient: { users: { getUser: vi.fn() } },
}));

vi.mock('../../db', () => ({
  prisma: {
    user: { findUnique: vi.fn(), count: vi.fn() },
    group: { count: vi.fn() },
    election: { count: vi.fn(), findFirst: vi.fn() },
    pick: { count: vi.fn() },
  },
}));

import { createApp } from '../../app';
import { prisma } from '../../db';

const mocked = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
  group: { count: ReturnType<typeof vi.fn> };
  election: { count: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> };
  pick: { count: ReturnType<typeof vi.fn> };
};

function asAdmin(): void {
  mocked.user.findUnique.mockResolvedValue({
    id: 'admin1',
    clerkId: 'clerk_test',
    role: 'SUPER_ADMIN',
  });
}

function asUser(): void {
  mocked.user.findUnique.mockResolvedValue({ id: 'u1', clerkId: 'clerk_test', role: 'USER' });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('admin overview — gating', () => {
  it('403 for a non-admin user', async () => {
    asUser();
    const res = await request(createApp()).get('/api/admin/overview');
    expect(res.status).toBe(403);
  });
});

describe('admin overview — GET /', () => {
  it('returns counts and participationRate against an active election', async () => {
    asAdmin();
    mocked.user.count.mockResolvedValue(10);
    mocked.group.count.mockResolvedValue(4);
    mocked.election.count.mockResolvedValue(2);
    mocked.election.findFirst.mockResolvedValue({ id: 'e1', nameHe: 'בחירות' });
    mocked.pick.count.mockResolvedValue(5);

    const res = await request(createApp()).get('/api/admin/overview');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      users: 10,
      groups: 4,
      elections: 2,
      activeElection: { id: 'e1', nameHe: 'בחירות' },
      picksSubmitted: 5,
      participationRate: 0.5,
    });
    // picksSubmitted counts only submitted picks for the active election.
    expect(mocked.pick.count).toHaveBeenCalledWith({
      where: { electionId: 'e1', submittedAt: { not: null } },
    });
  });

  it('returns 0 picks & 0 rate when there is no active election', async () => {
    asAdmin();
    mocked.user.count.mockResolvedValue(7);
    mocked.group.count.mockResolvedValue(0);
    mocked.election.count.mockResolvedValue(0);
    mocked.election.findFirst.mockResolvedValue(null);

    const res = await request(createApp()).get('/api/admin/overview');
    expect(res.status).toBe(200);
    expect(res.body.activeElection).toBeNull();
    expect(res.body.picksSubmitted).toBe(0);
    expect(res.body.participationRate).toBe(0);
    // No active election ⇒ never queries pick.count.
    expect(mocked.pick.count).not.toHaveBeenCalled();
  });

  it('participationRate is 0 when there are no users (no divide-by-zero)', async () => {
    asAdmin();
    mocked.user.count.mockResolvedValue(0);
    mocked.group.count.mockResolvedValue(1);
    mocked.election.count.mockResolvedValue(1);
    mocked.election.findFirst.mockResolvedValue({ id: 'e1', nameHe: 'בחירות' });
    mocked.pick.count.mockResolvedValue(0);

    const res = await request(createApp()).get('/api/admin/overview');
    expect(res.status).toBe(200);
    expect(res.body.participationRate).toBe(0);
  });
});
