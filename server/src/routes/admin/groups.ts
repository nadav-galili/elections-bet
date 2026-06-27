import { Router } from 'express';
import { prisma } from '../../db';
import { HttpError } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import { updateAdminGroupSchema } from '../../lib/validation/admin';

const router = Router();

// GET /api/admin/groups — every group with its admin and member count.
router.get('/', async (_req, res) => {
  const groups = await prisma.group.findMany({
    include: {
      admin: { select: { id: true, displayName: true, email: true } },
      _count: { select: { memberships: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(
    groups.map((g) => ({
      id: g.id,
      nameHe: g.nameHe,
      createdAt: g.createdAt,
      admin: g.admin,
      memberCount: g._count.memberships,
    })),
  );
});

// GET /api/admin/groups/:id — one group with its FULL member roster, for the
// god-mode reassign-admin / remove-member dialogs. Unlike the player route
// (GET /api/groups/:id) this is NOT membership-gated — the super-admin manages
// groups they don't belong to — and it never returns picks (no privacy concern).
router.get('/:id', async (req, res) => {
  const id = String(req.params.id);
  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      memberships: {
        include: {
          user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });
  if (!group) throw new HttpError(404, 'הקבוצה לא נמצאה');
  res.json({
    id: group.id,
    nameHe: group.nameHe,
    adminUserId: group.adminUserId,
    createdAt: group.createdAt,
    memberships: group.memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      joinedAt: m.joinedAt,
      user: m.user,
    })),
  });
});

// PATCH /api/admin/groups/:id — rename and/or reassign admin.
router.patch('/:id', validate(updateAdminGroupSchema), async (req, res) => {
  const id = String(req.params.id);
  const { nameHe, adminUserId } = req.body as { nameHe?: string; adminUserId?: string };

  const group = await prisma.group.findUnique({ where: { id } });
  if (!group) throw new HttpError(404, 'הקבוצה לא נמצאה');

  const updateData: { nameHe?: string; admin?: { connect: { id: string } } } = {};
  if (nameHe !== undefined) updateData.nameHe = nameHe;
  if (adminUserId !== undefined) {
    // The new admin must already be a current member of the group.
    const membership = await prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId: id, userId: adminUserId } },
    });
    if (!membership) {
      throw new HttpError(400, 'המנהל החדש חייב להיות חבר בקבוצה');
    }
    updateData.admin = { connect: { id: adminUserId } };
  }

  // Return the same projected shape as GET / (never the raw Group — that would
  // leak the secret inviteToken and not match the client's AdminGroup type).
  const updated = await prisma.group.update({
    where: { id },
    data: updateData,
    include: {
      admin: { select: { id: true, displayName: true, email: true } },
      _count: { select: { memberships: true } },
    },
  });
  res.json({
    id: updated.id,
    nameHe: updated.nameHe,
    createdAt: updated.createdAt,
    admin: updated.admin,
    memberCount: updated._count.memberships,
  });
});

// DELETE /api/admin/groups/:id — delete a group (cascades to memberships).
router.delete('/:id', async (req, res) => {
  const id = String(req.params.id);
  const group = await prisma.group.findUnique({ where: { id } });
  if (!group) throw new HttpError(404, 'הקבוצה לא נמצאה');
  await prisma.group.delete({ where: { id } });
  res.status(204).end();
});

// DELETE /api/admin/groups/:id/members/:userId — remove a member from a group.
// Reuses the succession logic from the player `DELETE /:id/leave` handler (NOT
// the player `DELETE /:id/members/:userId`, which is a plain delete that refuses
// to remove the admin): god-mode can remove anyone, including the admin, so if
// the removed user was the admin it promotes the earliest-joined remaining
// member, or deletes the group when no members remain.
router.delete('/:id/members/:userId', async (req, res) => {
  const groupId = String(req.params.id);
  const targetUserId = String(req.params.userId);

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new HttpError(404, 'הקבוצה לא נמצאה');

  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId: targetUserId } },
  });
  if (!membership) throw new HttpError(404, 'החבר לא נמצא בקבוצה');

  await prisma.$transaction(async (tx) => {
    await tx.groupMembership.delete({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });

    if (group.adminUserId !== targetUserId) return;

    // The removed user was the admin: re-query remaining members AFTER the
    // delete and either promote the earliest joiner or delete the empty group.
    const next = await tx.groupMembership.findFirst({
      where: { groupId, userId: { not: targetUserId } },
      orderBy: { joinedAt: 'asc' },
    });
    if (next) {
      await tx.group.update({ where: { id: groupId }, data: { adminUserId: next.userId } });
    } else {
      await tx.group.delete({ where: { id: groupId } });
    }
  });

  res.status(204).end();
});

export default router;
