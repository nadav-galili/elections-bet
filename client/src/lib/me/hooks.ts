import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/api';
import { leaderboardKeys } from '@/lib/leaderboard/hooks';

/** The current user's local profile — same shape from GET and PATCH /api/me. */
export interface Me {
  id: string;
  role: 'USER' | 'SUPER_ADMIN';
  displayName: string | null;
  avatarUrl: string | null;
}

/** Query‑key factory. `['me']` matches the key App.tsx already uses. */
export const meKeys = {
  me: ['me'] as const,
};

export function useMe() {
  const apiClient = useApi();
  return useQuery({
    queryKey: meKeys.me,
    queryFn: async () => (await apiClient.get('/api/me')).data as Me,
    retry: false,
  });
}

export function useUpdateDisplayName() {
  const apiClient = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (displayName: string) =>
      (await apiClient.patch('/api/me', { displayName })).data as Me,
    onSuccess: () => {
      // The name renders on the board, so refresh both.
      void queryClient.invalidateQueries({ queryKey: meKeys.me });
      void queryClient.invalidateQueries({ queryKey: leaderboardKeys.all });
    },
  });
}
