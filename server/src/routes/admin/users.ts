import { Router } from 'express';
import { prisma } from '../../db';
import { HttpError } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import { AuthedRequest } from '../../middleware/auth';
import { updateAdminUserSchema } from '../../lib/validation/admin';

const router = Router();

// The shape returned for every admin user view.
const adminUserSelect = {
  id: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  role: true,
  bannedAt: true,
  createdAt: true,
} as const;

// GET /api/admin/users?q= — search users by display name / email.
router.get('/', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { displayName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    select: adminUserSelect,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(users);
});

// PATCH /api/admin/users/:id — rename and/or change role.
router.patch('/:id', validate(updateAdminUserSchema), async (req, res) => {
  const id = String(req.params.id);
  const dbUser = (req as AuthedRequest).dbUser!;
  const { displayName, role } = req.body as {
    displayName?: string;
    role?: 'USER' | 'SUPER_ADMIN';
  };

  // A super-admin may not change their own role (no self-demotion lockout).
  if (id === dbUser.id && role !== undefined) {
    throw new HttpError(400, 'לא ניתן לשנות את התפקיד של עצמך');
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'המשתמש לא נמצא');

  // Super-admins are mutually protected: you can promote a USER, but you can't
  // demote another super-admin (consistent with the ban/delete guards below).
  if (role !== undefined && existing.role === 'SUPER_ADMIN' && id !== dbUser.id) {
    throw new HttpError(400, 'לא ניתן לשנות תפקיד של מנהל-על');
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { displayName, role },
    select: adminUserSelect,
  });
  res.json(updated);
});

// POST /api/admin/users/:id/ban — set the reversible ban flag.
router.post('/:id/ban', async (req, res) => {
  const id = String(req.params.id);
  const dbUser = (req as AuthedRequest).dbUser!;

  if (id === dbUser.id) throw new HttpError(400, 'לא ניתן להשעות את עצמך');

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'המשתמש לא נמצא');
  if (existing.role === 'SUPER_ADMIN') throw new HttpError(400, 'לא ניתן להשעות מנהל-על');

  const updated = await prisma.user.update({
    where: { id },
    data: { bannedAt: new Date() },
    select: adminUserSelect,
  });
  res.json(updated);
});

// DELETE /api/admin/users/:id/ban — clear the ban flag (unban).
router.delete('/:id/ban', async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'המשתמש לא נמצא');

  const updated = await prisma.user.update({
    where: { id },
    data: { bannedAt: null },
    select: adminUserSelect,
  });
  res.json(updated);
});

// DELETE /api/admin/users/:id — hard delete a user.
// Picks/scores/memberships cascade. Group.admin ("GroupAdmin") has NO db
// cascade, so we reassign / delete every group this user admins first.
router.delete('/:id', async (req, res) => {
  const id = String(req.params.id);
  const dbUser = (req as AuthedRequest).dbUser!;

  if (id === dbUser.id) throw new HttpError(400, 'לא ניתן למחוק את עצמך');

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'המשתמש לא נמצא');
  if (existing.role === 'SUPER_ADMIN') throw new HttpError(400, 'לא ניתן למחוק מנהל-על');

  await prisma.$transaction(async (tx) => {
    const adminGroups = await tx.group.findMany({ where: { adminUserId: id } });
    for (const group of adminGroups) {
      // Promote the earliest-joined remaining member, or delete the now-orphan
      // group when this user is the only/last member.
      const next = await tx.groupMembership.findFirst({
        where: { groupId: group.id, userId: { not: id } },
        orderBy: { joinedAt: 'asc' },
      });
      if (next) {
        await tx.group.update({
          where: { id: group.id },
          data: { adminUserId: next.userId },
        });
      } else {
        await tx.group.delete({ where: { id: group.id } });
      }
    }
    await tx.user.delete({ where: { id } });
  });

  res.status(204).end();
});

export default router;
