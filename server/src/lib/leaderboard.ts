// Leaderboard ranking — pure, deterministic, side-effect free.
// Shared by the global and group leaderboard endpoints.

/** One participant's raw inputs for ranking. */
export interface LeaderboardEntry {
  userId: string;
  total: number;
  /** Pick submission time; null sorts LAST (treated as "submitted never"). */
  submittedAt: Date | null;
  displayName: string | null;
  avatarUrl: string | null;
}

/** A ranked, client-facing leaderboard row. */
export interface LeaderboardRow {
  rank: number;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  total: number;
}

/**
 * Rank entries with STANDARD COMPETITION RANKING (ties share a rank, the next
 * rank skips — e.g. 1, 1, 3).
 *
 * Ordering is fully deterministic:
 *   1. total DESC (higher score ranks first)
 *   2. submittedAt ASC (earlier submission ranks first; null sorts LAST)
 *   3. userId ASC (final stable tiebreak)
 *
 * Two rows SHARE a rank iff they have the same `total`. The rank value is the
 * 1-based position of the first row in each equal-total run.
 */
export function rankEntries(entries: LeaderboardEntry[]): LeaderboardRow[] {
  const sorted = [...entries].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;

    // null submittedAt sorts last; otherwise earlier time first.
    const at = a.submittedAt ? a.submittedAt.getTime() : Number.POSITIVE_INFINITY;
    const bt = b.submittedAt ? b.submittedAt.getTime() : Number.POSITIVE_INFINITY;
    if (at !== bt) return at - bt;

    if (a.userId < b.userId) return -1;
    if (a.userId > b.userId) return 1;
    return 0;
  });

  const rows: LeaderboardRow[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    // Competition ranking: a row with the same total as its predecessor shares
    // that rank; otherwise its rank is its 1-based position (so ranks skip).
    const rank = i > 0 && sorted[i - 1].total === e.total ? rows[i - 1].rank : i + 1;
    rows.push({
      rank,
      userId: e.userId,
      displayName: e.displayName,
      avatarUrl: e.avatarUrl,
      total: e.total,
    });
  }
  return rows;
}
