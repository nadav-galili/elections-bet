import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/api';
import type {
  AdminGroup,
  AdminGroupDetail,
  AdminOverview,
  AdminUser,
  Election,
  ElectionDetail,
  ElectionInput,
  Party,
  PartyInput,
  ResultEntry,
  ResultsStatus,
  Role,
} from '@/lib/admin/types';

/** Query-key factory — keep these consistent across hooks and tests. */
export const adminKeys = {
  elections: ['admin', 'elections'] as const,
  election: (id: string) => ['admin', 'election', id] as const,
  allGroups: ['admin', 'groups'] as const,
  group: (id: string) => ['admin', 'group', id] as const,
  users: (q: string) => ['admin', 'users', q] as const,
  overview: ['admin', 'overview'] as const,
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

export function useSetResults(electionId: string) {
  const apiClient = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entries: ResultEntry[]) =>
      (await apiClient.patch(`/api/admin/elections/${electionId}/results`, { entries }))
        .data as ElectionDetail,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.election(electionId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.elections });
    },
  });
}

export function usePublishResults(electionId: string) {
  const apiClient = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (status: Exclude<ResultsStatus, 'NONE'>) =>
      (await apiClient.post(`/api/admin/elections/${electionId}/publish`, { status }))
        .data as ElectionDetail,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.election(electionId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys.elections });
    },
  });
}

/* ── God-mode: groups ───────────────────────────────────────────────────── */

export function useAllGroups() {
  const apiClient = useApi();
  return useQuery({
    queryKey: adminKeys.allGroups,
    queryFn: async () => (await apiClient.get('/api/admin/groups')).data as AdminGroup[],
  });
}

/** One group's full roster from the admin surface (not membership-gated). */
export function useAdminGroup(id: string) {
  const apiClient = useApi();
  return useQuery({
    queryKey: adminKeys.group(id),
    queryFn: async () => (await apiClient.get(`/api/admin/groups/${id}`)).data as AdminGroupDetail,
    enabled: Boolean(id),
  });
}

export function useDeleteGroupAdmin() {
  const apiClient = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/admin/groups/${id}`);
      return id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.allGroups });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overview });
    },
  });
}

export function useRemoveGroupMemberAdmin() {
  const apiClient = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      await apiClient.delete(`/api/admin/groups/${groupId}/members/${userId}`);
      return { groupId, userId };
    },
    onSuccess: ({ groupId }) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.allGroups });
      void queryClient.invalidateQueries({ queryKey: adminKeys.group(groupId) });
    },
  });
}

export function useUpdateGroupAdmin() {
  const apiClient = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: { nameHe?: string; adminUserId?: string };
    }) => (await apiClient.patch(`/api/admin/groups/${id}`, input)).data as AdminGroup,
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.allGroups });
      void queryClient.invalidateQueries({ queryKey: adminKeys.group(id) });
    },
  });
}

/* ── God-mode: users ────────────────────────────────────────────────────── */

export function useUsers(q: string) {
  const apiClient = useApi();
  return useQuery({
    queryKey: adminKeys.users(q),
    queryFn: async () =>
      (await apiClient.get('/api/admin/users', { params: { q } })).data as AdminUser[],
  });
}

export function useUpdateUser() {
  const apiClient = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: { displayName?: string; role?: Role };
    }) => (await apiClient.patch(`/api/admin/users/${id}`, input)).data as AdminUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useBanUser() {
  const apiClient = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.post(`/api/admin/users/${id}/ban`)).data as AdminUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useUnbanUser() {
  const apiClient = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.delete(`/api/admin/users/${id}/ban`)).data as AdminUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useDeleteUser() {
  const apiClient = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/admin/users/${id}`);
      return id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: adminKeys.allGroups });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overview });
    },
  });
}

/* ── God-mode: overview ─────────────────────────────────────────────────── */

export function useOverview() {
  const apiClient = useApi();
  return useQuery({
    queryKey: adminKeys.overview,
    queryFn: async () => (await apiClient.get('/api/admin/overview')).data as AdminOverview,
  });
}
