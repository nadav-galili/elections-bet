import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Clerk is fully stubbed: middleware passes through, getAuth yields a fixed user.
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuth: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: 'clerk_test' }),
  clerkClient: { users: { getUser: vi.fn() } },
}));

// group/groupMembership are shared so the interactive $transaction callback
// receives the same mock fns the tests assert against (elections.test.ts pattern).
vi.mock('../../db', () => {
  const group = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const groupMembership = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
  };
  return {
    prisma: {
      user: { findUnique: vi.fn() },
      group,
      groupMembership,
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({ group, groupMembership })),
    },
  };
});

import { createApp } from '../../app';
import { prisma } from '../../db';

const mocked = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
  group: Record<'findMany' | 'findUnique' | 'update' | 'delete', ReturnType<typeof vi.fn>>;
  groupMembership: Record<'findUnique' | 'findFirst' | 'delete', ReturnType<typeof vi.fn>>;
  $transaction: ReturnType<typeof vi.fn>;
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

describe('admin groups — gating', () => {
  it('403 for a non-admin user', async () => {
    asUser();
    const res = await request(createApp()).get('/api/admin/groups');
    expect(res.status).toBe(403);
  });
});

describe('admin groups — GET /', () => {
  it('lists groups with admin and member count', async () => {
    asAdmin();
    mocked.group.findMany.mockResolvedValue([
      {
        id: 'g1',
        nameHe: 'חברים',
        createdAt: '2026-01-01T00:00:00.000Z',
        admin: { id: 'admin1', displayName: 'נדב', email: 'a@b.co' },
        _count: { memberships: 3 },
      },
    ]);
    const res = await request(createApp()).get('/api/admin/groups');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      id: 'g1',
      nameHe: 'חברים',
      admin: { id: 'admin1', displayName: 'נדב', email: 'a@b.co' },
      memberCount: 3,
    });
    expect(res.body[0]._count).toBeUndefined();
  });
});

describe('admin groups — GET /:id (roster for god-mode dialogs)', () => {
  it('403 for a non-admin user', async () => {
    asUser();
    const res = await request(createApp()).get('/api/admin/groups/g1');
    expect(res.status).toBe(403);
  });

  it('returns the group with its member roster (200), even for a non-member admin', async () => {
    asAdmin();
    mocked.group.findUnique.mockResolvedValue({
      id: 'g1',
      nameHe: 'חברים',
      adminUserId: 'u2',
      createdAt: '2026-01-01T00:00:00.000Z',
      memberships: [
        {
          id: 'm2',
          userId: 'u2',
          joinedAt: '2026-01-01T00:00:00.000Z',
          user: { id: 'u2', displayName: 'דנה', email: 'd@e.co', avatarUrl: null },
        },
      ],
    });
    const res = await request(createApp()).get('/api/admin/groups/g1');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'g1',
      adminUserId: 'u2',
      memberships: [{ userId: 'u2', user: { displayName: 'דנה' } }],
    });
  });

  it('404 for a missing group', async () => {
    asAdmin();
    mocked.group.findUnique.mockResolvedValue(null);
    const res = await request(createApp()).get('/api/admin/groups/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('הקבוצה לא נמצאה');
  });
});

describe('admin groups — PATCH /:id', () => {
  it('renames a group (200) and never leaks the inviteToken', async () => {
    asAdmin();
    mocked.group.findUnique.mockResolvedValue({ id: 'g1', nameHe: 'ישן' });
    mocked.group.update.mockResolvedValue({
      id: 'g1',
      nameHe: 'חדש',
      createdAt: '2026-01-01T00:00:00.000Z',
      inviteToken: 'secret-token',
      admin: { id: 'admin1', displayName: 'נדב', email: 'a@b.co' },
      _count: { memberships: 2 },
    });
    const res = await request(createApp()).patch('/api/admin/groups/g1').send({ nameHe: 'חדש' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ nameHe: 'חדש', memberCount: 2 });
    // The secret invite token must NOT be projected into the admin response.
    expect(res.body.inviteToken).toBeUndefined();
  });

  it('reassigns admin to a current member (200)', async () => {
    asAdmin();
    // adminUserId is validated as a cuid, so use a real-shaped id.
    const newAdminId = 'clabcdefg0000xyz12345678a';
    mocked.group.findUnique.mockResolvedValue({ id: 'g1', nameHe: 'g' });
    mocked.groupMembership.findUnique.mockResolvedValue({ id: 'm2', userId: newAdminId });
    mocked.group.update.mockResolvedValue({
      id: 'g1',
      nameHe: 'g',
      createdAt: '2026-01-01T00:00:00.000Z',
      admin: { id: newAdminId, displayName: 'חבר', email: null },
      _count: { memberships: 2 },
    });
    const res = await request(createApp())
      .patch('/api/admin/groups/g1')
      .send({ adminUserId: newAdminId });
    expect(res.status).toBe(200);
    expect(mocked.group.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'g1' },
        data: expect.objectContaining({ admin: { connect: { id: newAdminId } } }),
      }),
    );
  });

  it('400 when the new admin is not a member', async () => {
    asAdmin();
    const newAdminId = 'clabcdefg0000xyz12345678b';
    mocked.group.findUnique.mockResolvedValue({ id: 'g1', nameHe: 'g' });
    mocked.groupMembership.findUnique.mockResolvedValue(null);
    const res = await request(createApp())
      .patch('/api/admin/groups/g1')
      .send({ adminUserId: newAdminId });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('המנהל החדש חייב להיות חבר בקבוצה');
    expect(mocked.group.update).not.toHaveBeenCalled();
  });

  it('404 for a missing group', async () => {
    asAdmin();
    mocked.group.findUnique.mockResolvedValue(null);
    const res = await request(createApp()).patch('/api/admin/groups/nope').send({ nameHe: 'x' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('הקבוצה לא נמצאה');
  });
});

describe('admin groups — DELETE /:id', () => {
  it('deletes a group (204)', async () => {
    asAdmin();
    mocked.group.findUnique.mockResolvedValue({ id: 'g1' });
    mocked.group.delete.mockResolvedValue({});
    const res = await request(createApp()).delete('/api/admin/groups/g1');
    expect(res.status).toBe(204);
    expect(mocked.group.delete).toHaveBeenCalledWith({ where: { id: 'g1' } });
  });

  it('404 for a missing group', async () => {
    asAdmin();
    mocked.group.findUnique.mockResolvedValue(null);
    const res = await request(createApp()).delete('/api/admin/groups/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('הקבוצה לא נמצאה');
  });
});

describe('admin groups — DELETE /:id/members/:userId', () => {
  it('removes a non-admin member (204), no reassignment', async () => {
    asAdmin();
    mocked.group.findUnique.mockResolvedValue({ id: 'g1', adminUserId: 'admin1' });
    mocked.groupMembership.findUnique.mockResolvedValue({ id: 'm2', userId: 'u2' });
    mocked.groupMembership.delete.mockResolvedValue({});
    const res = await request(createApp()).delete('/api/admin/groups/g1/members/u2');
    expect(res.status).toBe(204);
    expect(mocked.groupMembership.delete).toHaveBeenCalledWith({
      where: { groupId_userId: { groupId: 'g1', userId: 'u2' } },
    });
    expect(mocked.group.update).not.toHaveBeenCalled();
    expect(mocked.group.delete).not.toHaveBeenCalled();
  });

  it('removing the admin promotes the earliest remaining member', async () => {
    asAdmin();
    mocked.group.findUnique.mockResolvedValue({ id: 'g1', adminUserId: 'u2' });
    mocked.groupMembership.findUnique.mockResolvedValue({ id: 'm2', userId: 'u2' });
    mocked.groupMembership.delete.mockResolvedValue({});
    mocked.groupMembership.findFirst.mockResolvedValue({ id: 'm3', userId: 'u3' });
    mocked.group.update.mockResolvedValue({});
    const res = await request(createApp()).delete('/api/admin/groups/g1/members/u2');
    expect(res.status).toBe(204);
    expect(mocked.group.update).toHaveBeenCalledWith({
      where: { id: 'g1' },
      data: { adminUserId: 'u3' },
    });
    expect(mocked.group.delete).not.toHaveBeenCalled();
  });

  it('removing the last member (the admin) deletes the group', async () => {
    asAdmin();
    mocked.group.findUnique.mockResolvedValue({ id: 'g1', adminUserId: 'u2' });
    mocked.groupMembership.findUnique.mockResolvedValue({ id: 'm2', userId: 'u2' });
    mocked.groupMembership.delete.mockResolvedValue({});
    mocked.groupMembership.findFirst.mockResolvedValue(null);
    mocked.group.delete.mockResolvedValue({});
    const res = await request(createApp()).delete('/api/admin/groups/g1/members/u2');
    expect(res.status).toBe(204);
    expect(mocked.group.delete).toHaveBeenCalledWith({ where: { id: 'g1' } });
    expect(mocked.group.update).not.toHaveBeenCalled();
  });

  it('404 when the group is missing', async () => {
    asAdmin();
    mocked.group.findUnique.mockResolvedValue(null);
    const res = await request(createApp()).delete('/api/admin/groups/nope/members/u2');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('הקבוצה לא נמצאה');
  });

  it('404 when the membership is missing', async () => {
    asAdmin();
    mocked.group.findUnique.mockResolvedValue({ id: 'g1', adminUserId: 'admin1' });
    mocked.groupMembership.findUnique.mockResolvedValue(null);
    const res = await request(createApp()).delete('/api/admin/groups/g1/members/u2');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('החבר לא נמצא בקבוצה');
  });
});
