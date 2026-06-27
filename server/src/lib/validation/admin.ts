import { z } from 'zod';

// Super-admin group god-mode: rename and/or reassign admin. At least one field
// must be present so a PATCH is always a real change and never a silent no-op.
export const updateAdminGroupSchema = z
  .object({
    nameHe: z.string().trim().min(1, 'שם הקבוצה הוא שדה חובה').optional(),
    adminUserId: z.string().cuid('מזהה משתמש לא תקין').optional(),
  })
  .refine((d) => d.nameHe !== undefined || d.adminUserId !== undefined, {
    message: 'לא בוצע שינוי',
  });

// Super-admin user moderation: rename and/or change role. At least one field
// required (same no-op guard as above).
export const updateAdminUserSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, 'שם התצוגה הוא שדה חובה')
      .max(50, 'שם התצוגה ארוך מדי')
      .optional(),
    role: z.enum(['USER', 'SUPER_ADMIN']).optional(),
  })
  .refine((d) => d.displayName !== undefined || d.role !== undefined, {
    message: 'לא בוצע שינוי',
  });

export type UpdateAdminGroupInput = z.infer<typeof updateAdminGroupSchema>;
export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;
