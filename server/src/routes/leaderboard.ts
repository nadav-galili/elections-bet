import { Router } from 'express';
import { prisma } from '../db';
import { HttpError } from '../middleware/error';
import { requireAuthMw, AuthedRequest } from '../middleware/auth';
import { rankEntries, type LeaderboardEntry, type LeaderboardResponse } from '../lib/leaderboard';
import { getActiveElection } from '../lib/election';

const router = Router();

// All leaderboard routes require authentication.
router.use(requireAuthMw);

function getDbUser(req: AuthedRequest) {
  if (!req.dbUser) throw new HttpError(500, 'Internal server error');
  return req.dbUser;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/** Parse & clamp a query param to a positive integer, guarding NaN. */
function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  return Math.min(Math.max(i, min), max);
}

function parsePaging(req: AuthedRequest): { limit: number; offset: number } {
  const limit = clampInt(req.query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = clampInt(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  return { limit, offset };
}

/**
 * Rank Score rows for an election (already scoped to a set of users by the
 * caller's query), pulling each pick's submittedAt for the tie-break, then
 * page the result. Returns the full published payload.
 *
 * `scores` carries the joined user displayName/avatarUrl; `submittedAtByUser`
 * maps userId → Pick.submittedAt for ordering ties.
 */
function buildPublishedPayload(
  scores: {
    userId: string;
    total: number;
    user: { displayName: string | null; avatarUrl: string | null };
  }[],
  submittedAtByUser: Map<string, Date | null>,
  callerUserId: string,
  limit: number,
  offset: number,
): Extract<LeaderboardResponse, { published: true }> {
  const entries: LeaderboardEntry[] = scores.map((s) => ({
    userId: s.userId,
    total: s.total,
    submittedAt: submittedAtByUser.get(s.userId) ?? null,
    displayName: s.user.displayName,
    avatarUrl: s.user.avatarUrl,
  }));

  const ranked = rankEntries(entries);

  // yourRank is the caller's rank value across the WHOLE board, independent of
  // the page slice returned to the client.
  const yourRow = ranked.find((r) => r.userId === callerUserId);
  const yourRank = yourRow ? yourRow.rank : null;

  return {
    published: true,
    rows: ranked.slice(offset, offset + limit),
    totalCount: ranked.length,
    yourRank,
  };
}

// GET /api/elections/:id/leaderboard — GLOBAL board for one election.
router.get('/elections/:id/leaderboard', async (req, res) => {
  const electionId = String(req.params.id);
  const callerUserId = getDbUser(req as AuthedRequest).id;
  const { limit, offset } = parsePaging(req as AuthedRequest);

  const election = await prisma.election.findUnique({
    where: { id: electionId },
    select: { id: true, resultsStatus: true },
  });
  if (!election) throw new HttpError(404, 'הבחירות לא נמצאו');

  // PRIVACY INVARIANT: pre-publish (NONE) leaks NO scores — only a count.
  // Never query Score in this branch.
  if (election.resultsStatus === 'NONE') {
    const participantCount = await prisma.pick.count({
      where: { electionId, submittedAt: { not: null } },
    });
    res.json({
      published: false,
      state: 'pre_publish',
      participantCount,
    } satisfies LeaderboardResponse);
    return;
  }

  // Published (PROVISIONAL | FINAL): rank ALL Score rows for the election.
  const scores = await prisma.score.findMany({
    where: { electionId },
    select: {
      userId: true,
      total: true,
      user: { select: { displayName: true, avatarUrl: true } },
    },
  });

  const picks = await prisma.pick.findMany({
    where: { electionId, userId: { in: scores.map((s) => s.userId) } },
    select: { userId: true, submittedAt: true },
  });
  const submittedAtByUser = new Map<string, Date | null>(
    picks.map((p) => [p.userId, p.submittedAt]),
  );

  res.json(buildPublishedPayload(scores, submittedAtByUser, callerUserId, limit, offset));
});

// GET /api/groups/:id/leaderboard — GROUP board, scoped to group members.
router.get('/groups/:id/leaderboard', async (req, res) => {
  const groupId = String(req.params.id);
  const callerUserId = getDbUser(req as AuthedRequest).id;
  const { limit, offset } = parsePaging(req as AuthedRequest);

  // Non-members get 403 before any leaderboard data is fetched.
  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId: callerUserId } },
  });
  if (!membership) {
    throw new HttpError(403, 'אינך חבר בקבוצה זו');
  }

  const [memberships, activeElection] = await Promise.all([
    prisma.groupMembership.findMany({ where: { groupId }, select: { userId: true } }),
    getActiveElection(),
  ]);
  const memberIds = memberships.map((m) => m.userId);

  // No active election is a distinct state from "active but pre-publish": the
  // group board can't show a participation count for an election that isn't
  // running yet. Mirrors the 'no_active' phase the group detail page handles.
  if (!activeElection) {
    res.json({ published: false, state: 'no_active' } satisfies LeaderboardResponse);
    return;
  }

  // PRIVACY INVARIANT: pre-publish (NONE) leaks NO scores — only a count of
  // members with a submitted pick. Never query Score in this branch.
  if (activeElection.resultsStatus === 'NONE') {
    const participantCount = await prisma.pick.count({
      where: {
        electionId: activeElection.id,
        submittedAt: { not: null },
        userId: { in: memberIds },
      },
    });
    res.json({
      published: false,
      state: 'pre_publish',
      participantCount,
    } satisfies LeaderboardResponse);
    return;
  }

  // Published: rank Score rows scoped to the group's members only.
  const scores = await prisma.score.findMany({
    where: { electionId: activeElection.id, userId: { in: memberIds } },
    select: {
      userId: true,
      total: true,
      user: { select: { displayName: true, avatarUrl: true } },
    },
  });

  const picks = await prisma.pick.findMany({
    where: { electionId: activeElection.id, userId: { in: scores.map((s) => s.userId) } },
    select: { userId: true, submittedAt: true },
  });
  const submittedAtByUser = new Map<string, Date | null>(
    picks.map((p) => [p.userId, p.submittedAt]),
  );

  res.json(buildPublishedPayload(scores, submittedAtByUser, callerUserId, limit, offset));
});

export default router;
