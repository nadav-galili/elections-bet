import { prisma } from '../db';

/**
 * The single active election (most recently created).
 *
 * The app runs one election cycle at a time, so "the active election" is simply
 * the most-recently-created row. This is the one shared definition; callers
 * (leaderboard, groups, the public forecast page) must import it rather than
 * re-inlining the query, so the rule lives in exactly one place.
 *
 * Returns `null` when no election exists yet.
 */
export function getActiveElection() {
  return prisma.election.findFirst({ orderBy: { createdAt: 'desc' } });
}
