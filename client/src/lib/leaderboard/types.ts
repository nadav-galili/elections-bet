/** A single ranked row on a leaderboard (global or group-scoped). */
export interface LeaderboardRow {
  rank: number;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  total: number;
}

/**
 * Leaderboard response — a discriminated union on `published`.
 *
 * - `published: false` → results not yet published. Only a participation count
 *   is exposed; scores/rows are NEVER returned by the API in this branch.
 * - `published: true` → a ranked page slice plus the caller's own rank.
 */
export type LeaderboardResponse =
  | { published: false; participantCount: number }
  | { published: true; rows: LeaderboardRow[]; total: number; yourRank: number | null };
