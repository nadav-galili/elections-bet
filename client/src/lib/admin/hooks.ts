import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/api';
import type { Election, ElectionDetail, ElectionInput, Party, PartyInput } from '@/lib/admin/types';

/** Query-key factory — keep these consistent across hooks and tests. */
export const adminKeys = {
  elections: ['admin', 'elections'] as const,
  election: (id: string) => ['admin', 'election', id] as const,
};

export function useElections() {
  const apiClient = useApi();
  return useQuery({
    queryKey: adminKeys.elections,
    queryFn: async () => (await apiClient.get('/api/admin/elections')).data as Election[],
  });
}

export function useElection(id: string) {
  const apiClient = useApi();
  return useQuery({
    queryKey: adminKeys.election(id),
    queryFn: async () => (await apiClient.get(`/api/admin/elections/${id}`)).data as ElectionDetail,
    enabled: Boolean(id),
  });
}

export function useCreateElection() {
  const apiClient = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ElectionInput) =>
      (await apiClient.post('/api/admin/elections', input)).data as Election,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.elections });
    },
  });
}

export function useUpdateElection(id: string) {
  const apiClient = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ElectionInput>) =>
      (await apiClient.patch(`/api/admin/elections/${id}`, input)).data as Election,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.elections });
      void queryClient.invalidateQueries({ queryKey: adminKeys.election(id) });
    },
  });
}

export function useDeleteElection() {
  const apiClient = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/admin/elections/${id}`);
      return id;
    },
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.elections });
      void queryClient.invalidateQueries({ queryKey: adminKeys.election(id) });
    },
  });
}

export function useCreateParty(electionId: string) {
  const apiClient = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PartyInput) =>
      (await apiClient.post(`/api/admin/elections/${electionId}/parties`, input)).data as Party,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: adminKeys.election(electionId),
      });
    },
  });
}

export function useUpdateParty(electionId: string) {
  const apiClient = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ partyId, input }: { partyId: string; input: Partial<PartyInput> }) =>
      (await apiClient.patch(`/api/admin/elections/${electionId}/parties/${partyId}`, input))
        .data as Party,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: adminKeys.election(electionId),
      });
    },
  });
}

export function useDeleteParty(electionId: string) {
  const apiClient = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (partyId: string) => {
      await apiClient.delete(`/api/admin/elections/${electionId}/parties/${partyId}`);
      return partyId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: adminKeys.election(electionId),
      });
    },
  });
}
