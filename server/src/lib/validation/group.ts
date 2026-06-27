import { z } from 'zod'

export const createGroupSchema = z.object({
  nameHe: z.string().trim().min(1),
})

export const updateGroupSchema = z.object({
  nameHe: z.string().trim().min(1).optional(),
  adminUserId: z.string().cuid().optional(),
})

export const joinGroupSchema = z.object({
  inviteToken: z.string().min(1),
})

export type CreateGroupInput = z.infer<typeof createGroupSchema>
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>
export type JoinGroupInput = z.infer<typeof joinGroupSchema>
