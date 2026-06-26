import { z } from 'zod';

// revealAt is stored ABSOLUTE. When both lockAt and revealAt are present,
// reveal must not precede lock.
const revealAfterLock = (
  data: { lockAt?: Date | null; revealAt?: Date | null },
  ctx: z.RefinementCtx,
): void => {
  if (data.lockAt != null && data.revealAt != null && data.revealAt < data.lockAt) {
    ctx.addIssue({
      code: 'custom',
      path: ['revealAt'],
      message: 'מועד החשיפה חייב להיות אחרי מועד הנעילה',
    });
  }
};

// z.coerce.date() turns ISO strings (from JSON) into Date objects.
const dateField = z.coerce.date().nullable().optional();

export const createElectionSchema = z
  .object({
    nameHe: z.string().trim().min(1),
    lockAt: dateField,
    revealAt: dateField,
    blocALabel: z.string().nullable().optional(),
    blocBLabel: z.string().nullable().optional(),
  })
  .superRefine(revealAfterLock);

export const updateElectionSchema = z
  .object({
    nameHe: z.string().trim().min(1).optional(),
    lockAt: dateField,
    revealAt: dateField,
    blocALabel: z.string().nullable().optional(),
    blocBLabel: z.string().nullable().optional(),
  })
  .superRefine(revealAfterLock);

// '' -> null; otherwise must be a valid URL.
const logoUrlField = z
  .union([z.literal(''), z.url(), z.null()])
  .optional()
  .transform((v) => (v === '' || v == null ? null : v));

export const createPartySchema = z.object({
  nameHe: z.string().trim().min(1),
  logoUrl: logoUrlField,
  bloc: z.enum(['A', 'B', 'UNALIGNED']).default('UNALIGNED'),
  displayOrder: z.number().int().optional().default(0),
});

export const updatePartySchema = z.object({
  nameHe: z.string().trim().min(1).optional(),
  logoUrl: logoUrlField,
  bloc: z.enum(['A', 'B', 'UNALIGNED']).optional(),
  displayOrder: z.number().int().optional(),
});

export type CreateElectionInput = z.infer<typeof createElectionSchema>;
export type UpdateElectionInput = z.infer<typeof updateElectionSchema>;
export type CreatePartyInput = z.infer<typeof createPartySchema>;
export type UpdatePartyInput = z.infer<typeof updatePartySchema>;
