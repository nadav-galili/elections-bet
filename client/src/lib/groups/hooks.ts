import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/lib/api'
import type {
  Group,
  GroupDetail,
  CreateGroupInput,
  UpdateGroupInput,
} from './types'

/** Query‑key factory — keep these consistent across hooks and tests. */
export const groupKeys = {
  all: ['groups'] as const,
  lists: () => [...groupKeys.all, 'list'] as const,
  list: (filter: string) => [...groupKeys.lists(), { filter }] as const,
  details: () => [...groupKeys.all, 'detail'] as const,
  detail: (id: string) => [...groupKeys.details(), id] as const,
}

export function useGroups() {
  const apiClient = useApi()
  return useQuery({
    queryKey: groupKeys.lists(),
    queryFn: async () => (await apiClient.get('/api/groups')).data as Group[],
  })
}

export function useGroup(id: string) {
  const apiClient = useApi()
  return useQuery({
    queryKey: groupKeys.detail(id),
    queryFn: async () => (await apiClient.get(`/api/groups/${id}`)).data as GroupDetail,
    enabled: Boolean(id),
  })
}

export function useCreateGroup() {
  const apiClient = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateGroupInput) =>
      (await apiClient.post('/api/groups', input)).data as Group,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.lists() })
    },
  })
}

export function useUpdateGroup(id: string) {
  const apiClient = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateGroupInput) =>
      (await apiClient.patch(`/api/groups/${id}`, input)).data as Group,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: groupKeys.detail(id) })
    },
  })
}

export function useDeleteGroup() {
  const apiClient = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/groups/${id}`)
      return id
    },
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: groupKeys.detail(id) })
    },
  })
}

export function useJoinGroup() {
  const apiClient = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (inviteToken: string) =>
      (await apiClient.post(`/api/groups/join/${inviteToken}`)).data as Group,
    onSuccess: () => {
      // Invalidate groups list after joining
      void queryClient.invalidateQueries({ queryKey: groupKeys.lists() })
    },
  })
}

export function useLeaveGroup() {
  const apiClient = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (groupId: string) => {
      await apiClient.delete(`/api/groups/${groupId}/leave`)
      return groupId
    },
    onSuccess: (groupId) => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) })
    },
  })
}

export function useRemoveMember() {
  const apiClient = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      await apiClient.delete(`/api/groups/${groupId}/members/${userId}`)
      return { groupId, userId }
    },
    onSuccess: ({ groupId }) => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) })
    },
  })
}
