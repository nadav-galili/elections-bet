import { Router } from 'express';
import { prisma } from '../../db';

const router = Router();

// GET /api/admin/overview — headline counts for the admin dashboard.
// "Active election" = the most recently created one, matching the app-wide
// convention (getActiveElection in routes/groups.ts) — the app runs one cycle
// at a time. participationRate = submitted picks / total users; the denominator
// is the same `users` count shown alongside it (it includes the super-admin and
// any banned users, so the rate reads as "share of all accounts", not "of
// eligible players").
router.get('/', async (_req, res) => {
  const [users, groups, elections, activeElection] = await Promise.all([
    prisma.user.count(),
    prisma.group.count(),
    prisma.election.count(),
    prisma.election.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { id: true, nameHe: true },
    }),
  ]);

  const picksSubmitted = activeElection
    ? await prisma.pick.count({
        where: { electionId: activeElection.id, submittedAt: { not: null } },
      })
    : 0;

  const participationRate = users > 0 ? picksSubmitted / users : 0;

  res.json({
    users,
    groups,
    elections,
    activeElection,
    picksSubmitted,
    participationRate,
  });
});

export default router;
