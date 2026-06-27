import { z } from 'zod';

export const createGroupSchema = z.object({
  nameHe: z.string().trim().min(1, 'שם הקבוצה הוא שדה חובה'),
});

// Both fields are optional, but at least one must be present so a PATCH is a
// real change (rename and/or admin transfer) and never a silent no-op.
export const updateGroupSchema = z
  .object({
    nameHe: z.string().trim().min(1, 'שם הקבוצה הוא שדה חובה').optional(),
    adminUserId: z.string().cuid('מזהה משתמש לא תקין').optional(),
  })
  .refine((d) => d.nameHe !== undefined || d.adminUserId !== undefined, {
    message: 'לא בוצע שינוי',
  });

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
