import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { HttpError } from '../middleware/error';
import { validate } from '../middleware/validate';
import { requireAuthMw, AuthedRequest } from '../middleware/auth';
import { createGroupSchema, updateGroupSchema } from '../lib/validation/group';
import { isRevealed } from '../lib/time';

const router = Router();

// All routes require authentication
router.use(requireAuthMw);

function getDbUser(req: AuthedRequest) {
  if (!req.dbUser) throw new HttpError(500, 'Internal server error');
  return req.dbUser;
}

/**
 * The single election whose timeline drives group privacy. We treat the most
 * recently created election as the active one (the app runs one election cycle
 * at a time); privacy is then gated strictly on that election's revealAt.
 */
async function getActiveElection() {
  return prisma.election.findFirst({ orderBy: { createdAt: 'desc' } });
}

// POST /api/groups — create a group
router.post('/', validate(createGroupSchema), async (req, res) => {
  const { nameHe } = req.body;
  const adminUserId = getDbUser(req).id;

  // Create the group and the creator's membership atomically so we can never
  // end up with an admin-less or member-less group if one write fails.
  const group = await prisma.$transaction(async (tx) => {
    const created = await tx.group.create({
      data: { nameHe, adminUserId },
    });
    await tx.groupMembership.create({
      data: { groupId: created.id, userId: adminUserId },
    });
    return created;
  });

  res.status(201).json(group);
});

// GET /api/groups — groups the caller belongs to (with member counts)
router.get('/', async (req, res) => {
  const userId = getDbUser(req).id;

  const groups = await prisma.group.findMany({
    where: {
      memberships: {
        some: { userId },
      },
    },
    include: {
      _count: {
        select: { memberships: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(groups);
});

// GET /api/groups/:id — detail: members (displayName, avatar) + per-member pick
// status, privacy-gated by the active election's reveal phase.
router.get('/:id', async (req, res) => {
  const groupId = String(req.params.id);
  const userId = getDbUser(req).id;

  // Non-members get 403 before any group/pick data is fetched.
  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!membership) {
    throw new HttpError(403, 'אינך חבר בקבוצה זו');
  }

  const [group, activeElection] = await Promise.all([
    prisma.group.findUnique({
      where: { id: groupId },
      include: {
        memberships: {
          include: {
            user: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    }),
    getActiveElection(),
  ]);

  if (!group) {
    throw new HttpError(404, 'הקבוצה לא נמצאה');
  }

  // Fail closed: post-reveal requires a real revealAt that is now or in the
  // past. revealAt null or in the future ⇒ pre-reveal (never leak mandates).
  const now = new Date();
  const isPostReveal = isRevealed(activeElection?.revealAt ?? null, now);
  const privacyPhase = !activeElection
    ? ('no_active' as const)
    : isPostReveal
      ? ('post_reveal' as const)
      : ('pre_reveal' as const);

  const memberIds = group.memberships.map((m) => m.userId);

  const baseMembers = group.memberships.map((m) => ({
    id: m.id,
    userId: m.userId,
    joinedAt: m.joinedAt,
    user: m.user,
  }));

  let memberships;

  if (privacyPhase === 'no_active') {
    // No active election: members carry no pickStatus and no pick.
    memberships = baseMembers;
  } else if (privacyPhase === 'pre_reveal') {
    // PRIVACY INVARIANT: pick.entries are returned ONLY in the post_reveal branch — never merge these queries.
    // Pre-reveal: expose only whether each member submitted, never mandates.
    const picks = await prisma.pick.findMany({
      where: { userId: { in: memberIds }, electionId: activeElection!.id },
      select: { userId: true, submittedAt: true },
    });
    const submittedBy = new Set(picks.filter((p) => p.submittedAt != null).map((p) => p.userId));
    memberships = baseMembers.map((m) => ({
      ...m,
      pickStatus: submittedBy.has(m.userId) ? ('submitted' as const) : ('pending' as const),
    }));
  } else {
    // PRIVACY INVARIANT: pick.entries are returned ONLY in the post_reveal branch — never merge these queries.
    // Post-reveal: expose full picks (entries + mandates) per submitted member.
    const picks = await prisma.pick.findMany({
      where: { userId: { in: memberIds }, electionId: activeElection!.id },
      include: { entries: { include: { party: true } } },
    });
    const pickByUser = new Map(picks.map((p) => [p.userId, p]));
    memberships = baseMembers.map((m) => {
      const pick = pickByUser.get(m.userId);
      const submitted = pick != null && pick.submittedAt != null;
      return {
        ...m,
        pickStatus: submitted ? ('submitted' as const) : ('pending' as const),
        pick: submitted
          ? {
              submittedAt: pick!.submittedAt,
              entries: pick!.entries.map((e) => ({
                partyId: e.partyId,
                mandates: e.mandates,
                party: { nameHe: e.party.nameHe, logoUrl: e.party.logoUrl },
              })),
            }
          : undefined,
      };
    });
  }

  res.json({
    id: group.id,
    nameHe: group.nameHe,
    adminUserId: group.adminUserId,
    inviteToken: group.inviteToken,
    createdAt: group.createdAt,
    // The caller's DB User.id so the client can derive isAdmin/isMember
    // without ever comparing Clerk ids.
    currentUserId: userId,
    privacyPhase,
    activeElection: activeElection
      ? {
          id: activeElection.id,
          nameHe: activeElection.nameHe,
          lockAt: activeElection.lockAt,
          revealAt: activeElection.revealAt,
        }
      : null,
    memberships,
  });
});

// POST /api/groups/join/:inviteToken — idempotent join
router.post('/join/:inviteToken', async (req, res) => {
  const inviteToken = String(req.params.inviteToken);
  const userId = getDbUser(req).id;

  const group = await prisma.group.findUnique({
    where: { inviteToken },
  });
  if (!group) {
    throw new HttpError(404, 'קוד ההזמנה לא תקף');
  }

  // Idempotent: re-using a valid invite link must not error or duplicate.
  await prisma.groupMembership.upsert({
    where: { groupId_userId: { groupId: group.id, userId } },
    update: {},
    create: { groupId: group.id, userId },
  });

  res.status(200).json(group);
});

// DELETE /api/groups/:id/leave — caller leaves
router.delete('/:id/leave', async (req, res) => {
  const groupId = String(req.params.id);
  const userId = getDbUser(req).id;

  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!membership) {
    throw new HttpError(404, 'אינך חבר בקבוצה זו');
  }

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    throw new HttpError(404, 'הקבוצה לא נמצאה');
  }

  await prisma.$transaction(async (tx) => {
    await tx.groupMembership.delete({
      where: { groupId_userId: { groupId, userId } },
    });

    if (group.adminUserId !== userId) return;

    // Admin left: re-query remaining members AFTER the delete (never trust a
    // pre-delete snapshot) and either promote the earliest joiner or, if the
    // group is now empty, delete it.
    const next = await tx.groupMembership.findFirst({
      where: { groupId },
      orderBy: { joinedAt: 'asc' },
      take: 1,
    });
    if (next) {
      await tx.group.update({
        where: { id: groupId },
        data: { adminUserId: next.userId },
      });
    } else {
      await tx.group.delete({ where: { id: groupId } });
    }
  });

  res.status(204).end();
});

// DELETE /api/groups/:id/members/:userId — admin hard-removes a member.
// This is a hard delete; the removed user can rejoin later via the invite link.
router.delete('/:id/members/:userId', async (req, res) => {
  const groupId = String(req.params.id);
  const targetUserId = String(req.params.userId);
  const adminUserId = getDbUser(req).id;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
  });
  if (!group) {
    throw new HttpError(404, 'הקבוצה לא נמצאה');
  }
  if (group.adminUserId !== adminUserId) {
    throw new HttpError(403, 'רק מנהל הקבוצה יכול להסיר חבר');
  }

  // Cannot remove yourself via this endpoint (use leave)
  if (targetUserId === adminUserId) {
    throw new HttpError(400, 'להסרה עצמית יש להשתמש ב"עזיבה"');
  }

  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId: targetUserId } },
  });
  if (!membership) {
    throw new HttpError(404, 'החבר לא נמצא בקבוצה');
  }

  await prisma.groupMembership.delete({
    where: { groupId_userId: { groupId, userId: targetUserId } },
  });

  res.status(204).end();
});

// PATCH /api/groups/:id — admin renames and/or transfers admin
router.patch('/:id', validate(updateGroupSchema), async (req, res) => {
  const groupId = String(req.params.id);
  const adminUserId = getDbUser(req).id;
  const { nameHe, adminUserId: newAdminUserId } = req.body;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
  });
  if (!group) {
    throw new HttpError(404, 'הקבוצה לא נמצאה');
  }
  if (group.adminUserId !== adminUserId) {
    throw new HttpError(403, 'רק מנהל הקבוצה יכול לעדכן את הקבוצה');
  }

  const updateData: Prisma.GroupUpdateInput = {};
  if (nameHe !== undefined) updateData.nameHe = nameHe;
  if (newAdminUserId !== undefined) {
    // The new admin must already be a current member of the group.
    const membership = await prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId: newAdminUserId } },
    });
    if (!membership) {
      throw new HttpError(400, 'המנהל החדש חייב להיות חבר בקבוצה');
    }
    updateData.admin = { connect: { id: newAdminUserId } };
  }

  const updated = await prisma.group.update({
    where: { id: groupId },
    data: updateData,
  });

  res.json(updated);
});

// DELETE /api/groups/:id — admin deletes the group
router.delete('/:id', async (req, res) => {
  const groupId = String(req.params.id);
  const adminUserId = getDbUser(req).id;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
  });
  if (!group) {
    throw new HttpError(404, 'הקבוצה לא נמצאה');
  }
  if (group.adminUserId !== adminUserId) {
    throw new HttpError(403, 'רק מנהל הקבוצה יכול למחוק את הקבוצה');
  }

  await prisma.group.delete({ where: { id: groupId } });

  res.status(204).end();
});

export default router;
