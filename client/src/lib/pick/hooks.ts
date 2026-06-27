import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/api';
import type { Pick, PickEntry, PlayerElection, PlayerElectionDetail } from '@/lib/pick/types';

/** Query-key factory — keep these consistent across hooks and tests. */
export const pickKeys = {
  elections: ['elections'] as const,
  election: (id: string) => ['election', id] as const,
  pick: (id: string) => ['pick', id] as const,
};

export function usePlayerElections() {
  const apiClient = useApi();
  return useQuery({
    queryKey: pickKeys.elections,
    queryFn: async () => (await apiClient.get('/api/elections')).data as PlayerElection[],
  });
}

export function usePlayerElection(id: string) {
  const apiClient = useApi();
  return useQuery({
    queryKey: pickKeys.election(id),
    queryFn: async () => (await apiClient.get(`/api/elections/${id}`)).data as PlayerElectionDetail,
    enabled: Boolean(id),
  });
}

export function usePick(electionId: string) {
  const apiClient = useApi();
  return useQuery({
    queryKey: pickKeys.pick(electionId),
    queryFn: async () =>
      (await apiClient.get(`/api/elections/${electionId}/pick`)).data as Pick | null,
    enabled: Boolean(electionId),
  });
}

export function useSavePick(electionId: string) {
  const apiClient = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { entries: PickEntry[] }) =>
      (await apiClient.put(`/api/elections/${electionId}/pick`, input)).data as Pick,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pickKeys.pick(electionId) });
      void queryClient.invalidateQueries({ queryKey: pickKeys.election(electionId) });
    },
  });
}
