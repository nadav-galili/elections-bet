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
// (used by hard-delete) receives the same mock fns the tests assert against.
vi.mock('../../db', () => {
  const user = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const group = {
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const groupMembership = { findFirst: vi.fn() };
  return {
    prisma: {
      user,
      group,
      groupMembership,
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
        cb({ user, group, groupMembership }),
      ),
    },
  };
});

import { createApp } from '../../app';
import { prisma } from '../../db';

const mocked = prisma as unknown as {
  user: Record<'findUnique' | 'findMany' | 'update' | 'delete', ReturnType<typeof vi.fn>>;
  group: Record<'findMany' | 'update' | 'delete', ReturnType<typeof vi.fn>>;
  groupMembership: Record<'findFirst', ReturnType<typeof vi.fn>>;
  $transaction: ReturnType<typeof vi.fn>;
};

const adminGateUser = { id: 'admin1', clerkId: 'clerk_test', role: 'SUPER_ADMIN' as const };

// The role gate (requireSuperAdmin) calls user.findUnique({ where: { clerkId } })
// FIRST in every request; a handler that also reads a target by id calls
// user.findUnique({ where: { id } }) second. Branch on the where clause so each
// caller gets the right object.
function asAdminWithTarget(target: unknown): void {
  mocked.user.findUnique.mockImplementation(({ where }: { where: { clerkId?: string } }) =>
    where.clerkId ? Promise.resolve(adminGateUser) : Promise.resolve(target),
  );
}

function asUser(): void {
  mocked.user.findUnique.mockResolvedValue({ id: 'u1', clerkId: 'clerk_test', role: 'USER' });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('admin users — gating', () => {
  it('403 for a non-admin user', async () => {
    asUser();
    const res = await request(createApp()).get('/api/admin/users');
    expect(res.status).toBe(403);
  });
});

describe('admin users — GET /', () => {
  it('lists users (no q) — orderBy createdAt desc, take 100', async () => {
    mocked.user.findUnique.mockResolvedValue(adminGateUser);
    mocked.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        email: 'a@b.co',
        displayName: 'A',
        avatarUrl: null,
        role: 'USER',
        bannedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    const res = await request(createApp()).get('/api/admin/users');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(mocked.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined, orderBy: { createdAt: 'desc' }, take: 100 }),
    );
  });

  it('filters by q with case-insensitive OR', async () => {
    mocked.user.findUnique.mockResolvedValue(adminGateUser);
    mocked.user.findMany.mockResolvedValue([]);
    const res = await request(createApp()).get('/api/admin/users?q=nadav');
    expect(res.status).toBe(200);
    expect(mocked.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { displayName: { contains: 'nadav', mode: 'insensitive' } },
            { email: { contains: 'nadav', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });
});

describe('admin users — PATCH /:id', () => {
  it('updates displayName (200)', async () => {
    asAdminWithTarget({ id: 'u2', role: 'USER' });
    mocked.user.update.mockResolvedValue({ id: 'u2', displayName: 'חדש', role: 'USER' });
    const res = await request(createApp())
      .patch('/api/admin/users/u2')
      .send({ displayName: 'חדש' });
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('חדש');
  });

  it('404 for a missing user', async () => {
    asAdminWithTarget(null);
    const res = await request(createApp())
      .patch('/api/admin/users/nope')
      .send({ displayName: 'x' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('המשתמש לא נמצא');
  });

  it('400 when changing your OWN role', async () => {
    asAdminWithTarget(adminGateUser);
    const res = await request(createApp()).patch('/api/admin/users/admin1').send({ role: 'USER' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('לא ניתן לשנות את התפקיד של עצמך');
    expect(mocked.user.update).not.toHaveBeenCalled();
  });

  it('allows changing your OWN displayName (role untouched)', async () => {
    asAdminWithTarget(adminGateUser);
    mocked.user.update.mockResolvedValue({ id: 'admin1', displayName: 'שם' });
    const res = await request(createApp())
      .patch('/api/admin/users/admin1')
      .send({ displayName: 'שם' });
    expect(res.status).toBe(200);
  });

  it('400 when demoting ANOTHER super-admin (mutual protection)', async () => {
    asAdminWithTarget({ id: 'u2', role: 'SUPER_ADMIN' });
    const res = await request(createApp()).patch('/api/admin/users/u2').send({ role: 'USER' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('לא ניתן לשנות תפקיד של מנהל-על');
    expect(mocked.user.update).not.toHaveBeenCalled();
  });

  it('allows promoting a USER to SUPER_ADMIN', async () => {
    asAdminWithTarget({ id: 'u2', role: 'USER' });
    mocked.user.update.mockResolvedValue({ id: 'u2', role: 'SUPER_ADMIN' });
    const res = await request(createApp())
      .patch('/api/admin/users/u2')
      .send({ role: 'SUPER_ADMIN' });
    expect(res.status).toBe(200);
    expect(mocked.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'SUPER_ADMIN' }) }),
    );
  });
});

describe('admin users — ban / unban', () => {
  it('POST /:id/ban sets bannedAt (200)', async () => {
    asAdminWithTarget({ id: 'u2', role: 'USER' });
    mocked.user.update.mockResolvedValue({ id: 'u2', bannedAt: '2026-06-27T00:00:00.000Z' });
    const res = await request(createApp()).post('/api/admin/users/u2/ban');
    expect(res.status).toBe(200);
    expect(mocked.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ bannedAt: expect.any(Date) }) }),
    );
  });

  it('POST /:id/ban — 400 when banning yourself', async () => {
    asAdminWithTarget(adminGateUser);
    const res = await request(createApp()).post('/api/admin/users/admin1/ban');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('לא ניתן להשעות את עצמך');
    expect(mocked.user.update).not.toHaveBeenCalled();
  });

  it('POST /:id/ban — 400 when banning a SUPER_ADMIN', async () => {
    asAdminWithTarget({ id: 'u2', role: 'SUPER_ADMIN' });
    const res = await request(createApp()).post('/api/admin/users/u2/ban');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('לא ניתן להשעות מנהל-על');
    expect(mocked.user.update).not.toHaveBeenCalled();
  });

  it('POST /:id/ban — 404 for a missing user', async () => {
    asAdminWithTarget(null);
    const res = await request(createApp()).post('/api/admin/users/nope/ban');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('המשתמש לא נמצא');
  });

  it('DELETE /:id/ban clears bannedAt (200)', async () => {
    asAdminWithTarget({ id: 'u2', role: 'USER', bannedAt: new Date() });
    mocked.user.update.mockResolvedValue({ id: 'u2', bannedAt: null });
    const res = await request(createApp()).delete('/api/admin/users/u2/ban');
    expect(res.status).toBe(200);
    expect(mocked.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { bannedAt: null } }),
    );
  });

  it('DELETE /:id/ban — 404 for a missing user', async () => {
    asAdminWithTarget(null);
    const res = await request(createApp()).delete('/api/admin/users/nope/ban');
    expect(res.status).toBe(404);
  });
});

describe('admin users — DELETE /:id (hard delete)', () => {
  it('deletes a user with no admin groups (204)', async () => {
    asAdminWithTarget({ id: 'u2', role: 'USER' });
    mocked.group.findMany.mockResolvedValue([]);
    mocked.user.delete.mockResolvedValue({});
    const res = await request(createApp()).delete('/api/admin/users/u2');
    expect(res.status).toBe(204);
    expect(mocked.user.delete).toHaveBeenCalledWith({ where: { id: 'u2' } });
  });

  it('reassigns admin of each owned group before deleting', async () => {
    asAdminWithTarget({ id: 'u2', role: 'USER' });
    mocked.group.findMany.mockResolvedValue([{ id: 'g1', adminUserId: 'u2' }]);
    mocked.groupMembership.findFirst.mockResolvedValue({ id: 'm3', userId: 'u3' });
    mocked.group.update.mockResolvedValue({});
    mocked.user.delete.mockResolvedValue({});
    const res = await request(createApp()).delete('/api/admin/users/u2');
    expect(res.status).toBe(204);
    expect(mocked.group.update).toHaveBeenCalledWith({
      where: { id: 'g1' },
      data: { adminUserId: 'u3' },
    });
    expect(mocked.group.delete).not.toHaveBeenCalled();
    expect(mocked.user.delete).toHaveBeenCalledWith({ where: { id: 'u2' } });
  });

  it('deletes an orphan group (no other members) before deleting the user', async () => {
    asAdminWithTarget({ id: 'u2', role: 'USER' });
    mocked.group.findMany.mockResolvedValue([{ id: 'g1', adminUserId: 'u2' }]);
    mocked.groupMembership.findFirst.mockResolvedValue(null);
    mocked.group.delete.mockResolvedValue({});
    mocked.user.delete.mockResolvedValue({});
    const res = await request(createApp()).delete('/api/admin/users/u2');
    expect(res.status).toBe(204);
    expect(mocked.group.delete).toHaveBeenCalledWith({ where: { id: 'g1' } });
    expect(mocked.user.delete).toHaveBeenCalledWith({ where: { id: 'u2' } });
  });

  it('400 when deleting yourself', async () => {
    asAdminWithTarget(adminGateUser);
    const res = await request(createApp()).delete('/api/admin/users/admin1');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('לא ניתן למחוק את עצמך');
    expect(mocked.user.delete).not.toHaveBeenCalled();
  });

  it('400 when deleting a SUPER_ADMIN', async () => {
    asAdminWithTarget({ id: 'u2', role: 'SUPER_ADMIN' });
    const res = await request(createApp()).delete('/api/admin/users/u2');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('לא ניתן למחוק מנהל-על');
    expect(mocked.user.delete).not.toHaveBeenCalled();
  });

  it('404 for a missing user', async () => {
    asAdminWithTarget(null);
    const res = await request(createApp()).delete('/api/admin/users/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('המשתמש לא נמצא');
  });
});
