import { z } from 'zod';

export const updateMeSchema = z.object({
  displayName: z.string().trim().min(1, 'שם התצוגה הוא שדה חובה').max(50, 'שם התצוגה ארוך מדי'),
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
