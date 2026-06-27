import { z } from 'zod';

// A mandate value is 0 (party not predicted to pass) OR an integer 4..120.
// 1/2/3 are impossible: the 3.25% threshold means the real minimum is 4 seats.
const mandatesField = z
  .number()
  .int()
  .refine((n) => n === 0 || (n >= 4 && n <= 120), {
    message: 'מספר המנדטים חייב להיות 0 או בין 4 ל-120',
  });

export const pickEntrySchema = z.object({
  partyId: z.string().min(1),
  mandates: mandatesField,
});

export const upsertPickSchema = z
  .object({
    entries: z.array(pickEntrySchema).min(1),
  })
  .superRefine((data, ctx) => {
    const total = data.entries.reduce((sum, e) => sum + e.mandates, 0);
    if (total !== 120) {
      ctx.addIssue({
        code: 'custom',
        path: ['entries'],
        message: 'סך המנדטים חייב להיות 120 בדיוק',
      });
    }

    const seen = new Set<string>();
    for (const e of data.entries) {
      if (seen.has(e.partyId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['entries'],
          message: 'מפלגה כפולה בתחזית',
        });
        break;
      }
      seen.add(e.partyId);
    }
  });

export type UpsertPickInput = z.infer<typeof upsertPickSchema>;
