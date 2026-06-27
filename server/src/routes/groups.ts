import { Router } from 'express'
import { prisma } from '../db'
import { HttpError } from '../middleware/error'
import { validate } from '../middleware/validate'
import { requireAuthMw, AuthedRequest } from '../middleware/auth'
import {
  createGroupSchema,
  updateGroupSchema,
} from '../lib/validation/group'

const router = Router()

// All routes require authentication
router.use(requireAuthMw)

// Helper to get dbUser from request
function getDbUser(req: AuthedRequest) {
  if (!req.dbUser) throw new HttpError(500, 'Internal server error')
  return req.dbUser
}

// Helper to get the active election (most recent by createdAt)
async function getActiveElection() {
  const now = new Date()
  // Find the most recent election where lockAt is in the future, or revealAt is in the future, or results are not yet final
  // Simpler: take the most recent by creation, assuming there's only one active at a time.
  const election = await prisma.election.findFirst({
    where: {
      OR: [
        { lockAt: { gt: now } },
        { revealAt: { gt: now } },
        { resultsStatus: { not: 'FINAL' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  })
  return election
}

// POST /api/groups — create a group
router.post('/', validate(createGroupSchema), async (req, res) => {
  const { nameHe } = req.body
  const adminUserId = getDbUser(req).id

  const group = await prisma.group.create({
    data: {
      nameHe,
      adminUserId,
    },
  })

  // Create membership for creator
  await prisma.groupMembership.create({
    data: {
      groupId: group.id,
      userId: adminUserId,
    },
  })

  res.status(201).json(group)
})

// GET /api/groups — groups the caller belongs to (with member counts)
router.get('/', async (req, res) => {
  const userId = getDbUser(req).id

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
  })

  res.json(groups)
})

// GET /api/groups/:id — detail: members (displayName, avatar) + per-member pick status
// privacy-gated: caller must be a member
router.get('/:id', async (req, res) => {
  const groupId = String(req.params.id)
  const userId = getDbUser(req).id

  // Verify membership
  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId } },
  })
  if (!membership) {
    throw new HttpError(403, 'אינך חבר בקבוצה זו')
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
  ])

  if (!group) {
    throw new HttpError(404, 'הקבוצה לא נמצאה')
  }

  // Determine privacy phase
  const now = new Date()
  const isPreReveal = activeElection && activeElection.revealAt && activeElection.revealAt > now
  const isPostReveal = activeElection && activeElection.revealAt && activeElection.revealAt <= now

  const memberIds = group.memberships.map(m => m.userId)
  const pickStatusMap = new Map<string, { submittedAt: Date | null }>()
  const pickDetailsMap = new Map<string, { submittedAt: Date | null; entries?: Array<{ partyId: string; mandates: number; party?: { nameHe: string; logoUrl: string | null; bloc: string } }> }>()

  if (activeElection) {
    if (isPostReveal) {
      // Fetch picks with entries and party info
      const picks = await prisma.pick.findMany({
        where: {
          userId: { in: memberIds },
          electionId: activeElection.id,
        },
        include: {
          entries: {
            include: {
              party: true,
            },
          },
        },
      })
      picks.forEach(pick => {
        pickStatusMap.set(pick.userId, { submittedAt: pick.submittedAt })
        pickDetailsMap.set(pick.userId, {
          submittedAt: pick.submittedAt,
          entries: pick.entries.map(e => ({
            partyId: e.partyId,
            mandates: e.mandates,
            party: {
              nameHe: e.party.nameHe,
              logoUrl: e.party.logoUrl,
              bloc: e.party.bloc,
            },
          })),
        })
      })
    } else {
      // Pre-reveal or no reveal: only status
      const picks = await prisma.pick.findMany({
        where: {
          userId: { in: memberIds },
          electionId: activeElection.id,
        },
        select: { userId: true, submittedAt: true },
      })
      picks.forEach(pick => {
        pickStatusMap.set(pick.userId, { submittedAt: pick.submittedAt })
      })
    }
  }

  // Enrich members with pick status and optional details
  const membersWithStatus = group.memberships.map(m => ({
    ...m,
    pickStatus: activeElection
      ? (pickStatusMap.get(m.userId)?.submittedAt ? 'submitted' : 'pending')
      : 'no_active_election',
    pick: isPostReveal ? pickDetailsMap.get(m.userId) : undefined,
  }))

  res.json({
    ...group,
    memberships: membersWithStatus,
    activeElection: activeElection ? {
      id: activeElection.id,
      nameHe: activeElection.nameHe,
      lockAt: activeElection.lockAt,
      revealAt: activeElection.revealAt,
    } : null,
    privacyPhase: isPreReveal ? 'pre_reveal' : isPostReveal ? 'post_reveal' : 'no_active',
  })
})

// POST /api/groups/join/:inviteToken — idempotent join
router.post('/join/:inviteToken', async (req, res) => {
  const inviteToken = String(req.params.inviteToken)
  const userId = getDbUser(req).id

  const group = await prisma.group.findUnique({
    where: { inviteToken },
  })
  if (!group) {
    throw new HttpError(404, 'קוד ההזמנה לא תקף')
  }

  // Idempotent join: create membership if missing
  await prisma.groupMembership.upsert({
    where: {
      groupId_userId: { groupId: group.id, userId },
    },
    update: {}, // already exists, nothing to update
    create: {
      groupId: group.id,
      userId,
    },
  })

  res.status(200).json(group)
})

// DELETE /api/groups/:id/leave — caller leaves
router.delete('/:id/leave', async (req, res) => {
  const groupId = String(req.params.id)
  const userId = getDbUser(req).id

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      memberships: {
        orderBy: { joinedAt: 'asc' },
      },
    },
  })
  if (!group) {
    throw new HttpError(404, 'הקבוצה לא נמצאה')
  }

  // Remove membership
  await prisma.groupMembership.delete({
    where: { groupId_userId: { groupId, userId } },
  })

  // If caller was admin, need to auto-promote or delete group
  if (group.adminUserId === userId) {
    const remainingMemberships = group.memberships.filter(m => m.userId !== userId)
    if (remainingMemberships.length === 0) {
      // Group is empty, delete it
      await prisma.group.delete({ where: { id: groupId } })
    } else {
      // Auto-promote earliest-joined remaining member
      const newAdminUserId = remainingMemberships[0].userId
      await prisma.group.update({
        where: { id: groupId },
        data: { adminUserId: newAdminUserId },
      })
    }
  }

  res.status(204).end()
})

// DELETE /api/groups/:id/members/:userId — admin soft-removes a member
router.delete('/:id/members/:userId', async (req, res) => {
  const groupId = String(req.params.id)
  const targetUserId = String(req.params.userId)
  const adminUserId = getDbUser(req).id

  const group = await prisma.group.findUnique({
    where: { id: groupId },
  })
  if (!group) {
    throw new HttpError(404, 'הקבוצה לא נמצאה')
  }
  if (group.adminUserId !== adminUserId) {
    throw new HttpError(403, 'רק מנהל הקבוצה יכול להסיר חבר')
  }

  // Cannot remove yourself via this endpoint (use leave)
  if (targetUserId === adminUserId) {
    throw new HttpError(400, 'להסרה עצמית יש להשתמש ב"עזיבה"')
  }

  // Check membership exists
  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId: targetUserId } },
  })
  if (!membership) {
    throw new HttpError(404, 'החבר לא נמצא בקבוצה')
  }

  await prisma.groupMembership.delete({
    where: { groupId_userId: { groupId, userId: targetUserId } },
  })

  res.status(204).end()
})

// PATCH /api/groups/:id — admin renames and/or transfers admin
router.patch('/:id', validate(updateGroupSchema), async (req, res) => {
  const groupId = String(req.params.id)
  const adminUserId = getDbUser(req).id
  const { nameHe, adminUserId: newAdminUserId } = req.body

  const group = await prisma.group.findUnique({
    where: { id: groupId },
  })
  if (!group) {
    throw new HttpError(404, 'הקבוצה לא נמצאה')
  }
  if (group.adminUserId !== adminUserId) {
    throw new HttpError(403, 'רק מנהל הקבוצה יכול לעדכן את הקבוצה')
  }

  const updateData: any = {}
  if (nameHe !== undefined) updateData.nameHe = nameHe
  if (newAdminUserId !== undefined) {
    // Verify new admin is a member
    const membership = await prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId: newAdminUserId } },
    })
    if (!membership) {
      throw new HttpError(400, 'המנהל החדש חייב להיות חבר בקבוצה')
    }
    updateData.adminUserId = newAdminUserId
  }

  const updated = await prisma.group.update({
    where: { id: groupId },
    data: updateData,
  })

  res.json(updated)
})

// DELETE /api/groups/:id — admin deletes the group
router.delete('/:id', async (req, res) => {
  const groupId = String(req.params.id)
  const adminUserId = getDbUser(req).id

  const group = await prisma.group.findUnique({
    where: { id: groupId },
  })
  if (!group) {
    throw new HttpError(404, 'הקבוצה לא נמצאה')
  }
  if (group.adminUserId !== adminUserId) {
    throw new HttpError(403, 'רק מנהל הקבוצה יכול למחוק את הקבוצה')
  }

  await prisma.group.delete({ where: { id: groupId } })

  res.status(204).end()
})

export default router