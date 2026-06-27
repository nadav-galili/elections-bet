/** A single ranked row on a leaderboard (global or group-scoped). `total` is the player's score. */
export interface LeaderboardRow {
  rank: number;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  total: number;
}

/**
 * Leaderboard response — a discriminated union. MIRRORS the server type in
 * server/src/lib/leaderboard.ts; keep the two in sync.
 *
 * - `state: 'pre_publish'` → results not yet published. Only a participation
 *   count is exposed; scores/rows are NEVER returned by the API in this branch.
 * - `state: 'no_active'` → no active election (group board only).
 * - `published: true` → a ranked page slice (`totalCount` is the whole-board
 *   size) plus the caller's own rank.
 */
export type LeaderboardResponse =
  | { published: false; state: 'pre_publish'; participantCount: number }
  | { published: false; state: 'no_active' }
  | { published: true; rows: LeaderboardRow[]; totalCount: number; yourRank: number | null };
