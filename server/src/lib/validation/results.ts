import { z } from 'zod';

// An actual-mandate value is 0 (party did not pass) OR an integer 4..120.
// Same rule as predictions: the 3.25% threshold means the real minimum is 4.
const actualMandatesField = z
  .number()
  .int()
  .refine((n) => n === 0 || (n >= 4 && n <= 120), {
    message: 'מספר המנדטים חייב להיות 0 או בין 4 ל-120',
  });

export const resultEntrySchema = z.object({
  partyId: z.string().min(1),
  actualMandates: actualMandatesField,
});

export const setResultsSchema = z
  .object({
    entries: z.array(resultEntrySchema).min(1),
  })
  .superRefine((data, ctx) => {
    const total = data.entries.reduce((sum, e) => sum + e.actualMandates, 0);
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
          message: 'מפלגה כפולה בתוצאות',
        });
        break;
      }
      seen.add(e.partyId);
    }
  });

export const publishSchema = z.object({
  status: z.enum(['PROVISIONAL', 'FINAL']),
});

export type SetResultsInput = z.infer<typeof setResultsSchema>;
export type PublishInput = z.infer<typeof publishSchema>;
