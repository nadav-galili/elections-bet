import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Clerk is fully stubbed: middleware passes through, getAuth yields a fixed user.
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuth: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: 'clerk_test' }),
  clerkClient: { users: { getUser: vi.fn() } },
}));

// The transaction client (tx) exposes the same group/groupMembership fns the
// handlers call inside prisma.$transaction.
const tx = {
  group: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  groupMembership: {
    create: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
  },
};

// Prisma is stubbed per-test. requireAuthMw → ensureDbUser reads
// prisma.user.findUnique; the handlers read group/groupMembership/pick/election.
vi.mock('../db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    group: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    groupMembership: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
    pick: { findMany: vi.fn() },
    election: { findFirst: vi.fn() },
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  },
}));

import { createApp } from '../app';
import { prisma } from '../db';

const mocked = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
  group: Record<
    'create' | 'findMany' | 'findUnique' | 'update' | 'delete',
    ReturnType<typeof vi.fn>
  >;
  groupMembership: Record<'create' | 'findUnique' | 'delete' | 'upsert', ReturnType<typeof vi.fn>>;
  pick: { findMany: ReturnType<typeof vi.fn> };
  election: { findFirst: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

// requireAuthMw → ensureDbUser resolves the local DB user from the Clerk id.
function asUser(): void {
  mocked.user.findUnique.mockResolvedValue({
    id: 'u1',
    clerkId: 'clerk_test',
    role: 'USER',
  });
}

const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  asUser();
});

describe('GET /api/groups/:id — membership gating', () => {
  it('403 for a non-member', async () => {
    mocked.groupMembership.findUnique.mockResolvedValue(null);
    const res = await request(createApp()).get('/api/groups/g1');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('אינך חבר בקבוצה זו');
  });
});

describe('GET /api/groups/:id — privacy phases', () => {
  const groupWithMembers = {
    id: 'g1',
    nameHe: 'קבוצה',
    adminUserId: 'u1',
    inviteToken: 'tok1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    memberships: [
      {
        id: 'm1',
        userId: 'u1',
        joinedAt: new Date('2026-01-01T00:00:00.000Z'),
        user: { id: 'u1', displayName: 'נדב', avatarUrl: null },
      },
      {
        id: 'm2',
        userId: 'u2',
        joinedAt: new Date('2026-01-02T00:00:00.000Z'),
        user: { id: 'u2', displayName: 'דני', avatarUrl: null },
      },
    ],
  };

  it('pre-reveal: phase pre_reveal, pickStatus present, NO mandates leaked', async () => {
    mocked.groupMembership.findUnique.mockResolvedValue({ id: 'm1', userId: 'u1' });
    mocked.group.findUnique.mockResolvedValue(groupWithMembers);
    mocked.election.findFirst.mockResolvedValue({
      id: 'e1',
      nameHe: 'בחירות',
      lockAt: new Date(Date.now() - HOUR),
      revealAt: new Date(Date.now() + HOUR), // reveal in the FUTURE
    });
    mocked.pick.findMany.mockResolvedValue([
      { userId: 'u1', submittedAt: new Date('2026-01-03T00:00:00.000Z') },
    ]);

    const res = await request(createApp()).get('/api/groups/g1');
    expect(res.status).toBe(200);
    expect(res.body.privacyPhase).toBe('pre_reveal');
    expect(res.body.activeElection).not.toBeNull();
    const u1 = res.body.memberships.find((m: { userId: string }) => m.userId === 'u1');
    const u2 = res.body.memberships.find((m: { userId: string }) => m.userId === 'u2');
    expect(u1.pickStatus).toBe('submitted');
    expect(u2.pickStatus).toBe('pending');
    // Leak-prevention: the serialized body must not contain any mandates.
    expect(JSON.stringify(res.body)).not.toContain('mandates');
  });

  it('post-reveal: phase post_reveal, pick entries with mandates present', async () => {
    mocked.groupMembership.findUnique.mockResolvedValue({ id: 'm1', userId: 'u1' });
    mocked.group.findUnique.mockResolvedValue(groupWithMembers);
    mocked.election.findFirst.mockResolvedValue({
      id: 'e1',
      nameHe: 'בחירות',
      lockAt: new Date(Date.now() - 2 * HOUR),
      revealAt: new Date(Date.now() - HOUR), // reveal in the PAST
    });
    mocked.pick.findMany.mockResolvedValue([
      {
        userId: 'u1',
        submittedAt: new Date('2026-01-03T00:00:00.000Z'),
        entries: [
          {
            partyId: 'p1',
            mandates: 30,
            party: { nameHe: 'ליכוד', logoUrl: null },
          },
        ],
      },
    ]);

    const res = await request(createApp()).get('/api/groups/g1');
    expect(res.status).toBe(200);
    expect(res.body.privacyPhase).toBe('post_reveal');
    const u1 = res.body.memberships.find((m: { userId: string }) => m.userId === 'u1');
    expect(u1.pickStatus).toBe('submitted');
    expect(u1.pick.entries[0].mandates).toBe(30);
    expect(u1.pick.entries[0].party.nameHe).toBe('ליכוד');
  });

  it('no active election: phase no_active, activeElection null, no pickStatus', async () => {
    mocked.groupMembership.findUnique.mockResolvedValue({ id: 'm1', userId: 'u1' });
    mocked.group.findUnique.mockResolvedValue(groupWithMembers);
    mocked.election.findFirst.mockResolvedValue(null);

    const res = await request(createApp()).get('/api/groups/g1');
    expect(res.status).toBe(200);
    expect(res.body.privacyPhase).toBe('no_active');
    expect(res.body.activeElection).toBeNull();
    expect(res.body.currentUserId).toBe('u1');
    for (const m of res.body.memberships) {
      expect(m.pickStatus).toBeUndefined();
      expect(m.pick).toBeUndefined();
    }
    expect(mocked.pick.findMany).not.toHaveBeenCalled();
  });
});

describe('POST /api/groups — create', () => {
  it('201 and runs the create + membership in one transaction', async () => {
    tx.group.create.mockResolvedValue({
      id: 'g1',
      nameHe: 'קבוצה חדשה',
      adminUserId: 'u1',
      inviteToken: 'tok1',
    });
    tx.groupMembership.create.mockResolvedValue({ id: 'm1' });

    const res = await request(createApp()).post('/api/groups').send({ nameHe: 'קבוצה חדשה' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('g1');
    expect(res.body.inviteToken).toBe('tok1');
    expect(mocked.$transaction).toHaveBeenCalledOnce();
    expect(tx.group.create).toHaveBeenCalledOnce();
    expect(tx.groupMembership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ groupId: 'g1', userId: 'u1' }),
      }),
    );
  });

  it('400 on an empty nameHe', async () => {
    const res = await request(createApp()).post('/api/groups').send({ nameHe: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('שגיאת אימות');
    expect(Array.isArray(res.body.issues)).toBe(true);
  });
});

describe('POST /api/groups/join/:inviteToken', () => {
  it('200 and upserts the membership (idempotent) on a valid token', async () => {
    mocked.group.findUnique.mockResolvedValue({ id: 'g1', inviteToken: 'tok1' });
    mocked.groupMembership.upsert.mockResolvedValue({ id: 'm1' });

    const res = await request(createApp()).post('/api/groups/join/tok1');
    expect(res.status).toBe(200);
    expect(mocked.groupMembership.upsert).toHaveBeenCalledOnce();
  });

  it('404 on an invalid token', async () => {
    mocked.group.findUnique.mockResolvedValue(null);
    const res = await request(createApp()).post('/api/groups/join/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('קוד ההזמנה לא תקף');
  });
});

describe('DELETE /api/groups/:id/leave', () => {
  it('admin leaves with others: promotes earliest remaining member, no group delete', async () => {
    mocked.groupMembership.findUnique.mockResolvedValue({ id: 'm1', userId: 'u1' });
    mocked.group.findUnique.mockResolvedValue({ id: 'g1', adminUserId: 'u1' });
    tx.groupMembership.delete.mockResolvedValue({ id: 'm1' });
    // Earliest-joined remaining member after the delete.
    tx.groupMembership.findFirst.mockResolvedValue({ id: 'm2', userId: 'u2' });

    const res = await request(createApp()).delete('/api/groups/g1/leave');
    expect(res.status).toBe(204);
    expect(tx.group.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'g1' },
        data: { adminUserId: 'u2' },
      }),
    );
    expect(tx.group.delete).not.toHaveBeenCalled();
  });

  it('admin leaves as last member: deletes the group', async () => {
    mocked.groupMembership.findUnique.mockResolvedValue({ id: 'm1', userId: 'u1' });
    mocked.group.findUnique.mockResolvedValue({ id: 'g1', adminUserId: 'u1' });
    tx.groupMembership.delete.mockResolvedValue({ id: 'm1' });
    tx.groupMembership.findFirst.mockResolvedValue(null); // none remain

    const res = await request(createApp()).delete('/api/groups/g1/leave');
    expect(res.status).toBe(204);
    expect(tx.group.delete).toHaveBeenCalledWith({ where: { id: 'g1' } });
    expect(tx.group.update).not.toHaveBeenCalled();
  });

  it('404 when the caller is not a member', async () => {
    mocked.groupMembership.findUnique.mockResolvedValue(null);
    const res = await request(createApp()).delete('/api/groups/g1/leave');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('אינך חבר בקבוצה זו');
  });
});

describe('admin-only route gating', () => {
  it('403 on PATCH /:id for a non-admin', async () => {
    mocked.group.findUnique.mockResolvedValue({ id: 'g1', adminUserId: 'other' });
    const res = await request(createApp()).patch('/api/groups/g1').send({ nameHe: 'שם חדש' });
    expect(res.status).toBe(403);
  });

  it('403 on DELETE /:id for a non-admin', async () => {
    mocked.group.findUnique.mockResolvedValue({ id: 'g1', adminUserId: 'other' });
    const res = await request(createApp()).delete('/api/groups/g1');
    expect(res.status).toBe(403);
  });

  it('403 on DELETE /:id/members/:userId for a non-admin', async () => {
    mocked.group.findUnique.mockResolvedValue({ id: 'g1', adminUserId: 'other' });
    const res = await request(createApp()).delete('/api/groups/g1/members/u2');
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/groups/:id — admin transfer', () => {
  it('400 when transferring to a non-member', async () => {
    mocked.group.findUnique.mockResolvedValue({ id: 'g1', adminUserId: 'u1' });
    mocked.groupMembership.findUnique.mockResolvedValue(null); // target not a member
    const res = await request(createApp())
      .patch('/api/groups/g1')
      .send({ adminUserId: 'clh1234567890abcdefghijkl' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('המנהל החדש חייב להיות חבר בקבוצה');
  });
});
