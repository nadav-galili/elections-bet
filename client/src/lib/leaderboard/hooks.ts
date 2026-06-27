import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/lib/api';
import type { LeaderboardResponse } from './types';

/** Pagination options shared by both boards. limit defaults server-side to 50. */
export interface LeaderboardParams {
  limit?: number;
  offset?: number;
}

/** Query‑key factory — keep these consistent across hooks and tests. */
export const leaderboardKeys = {
  all: ['leaderboard'] as const,
  election: (electionId: string, params: LeaderboardParams) =>
    [...leaderboardKeys.all, 'election', electionId, params] as const,
  group: (groupId: string, params: LeaderboardParams) =>
    [...leaderboardKeys.all, 'group', groupId, params] as const,
};

export function useElectionLeaderboard(electionId: string, params: LeaderboardParams = {}) {
  const apiClient = useApi();
  return useQuery({
    queryKey: leaderboardKeys.election(electionId, params),
    queryFn: async () =>
      (
        await apiClient.get(`/api/elections/${electionId}/leaderboard`, {
          params: { limit: params.limit, offset: params.offset },
        })
      ).data as LeaderboardResponse,
    enabled: Boolean(electionId),
  });
}

export function useGroupLeaderboard(groupId: string, params: LeaderboardParams = {}) {
  const apiClient = useApi();
  return useQuery({
    queryKey: leaderboardKeys.group(groupId, params),
    queryFn: async () =>
      (
        await apiClient.get(`/api/groups/${groupId}/leaderboard`, {
          params: { limit: params.limit, offset: params.offset },
        })
      ).data as LeaderboardResponse,
    enabled: Boolean(groupId),
  });
}
