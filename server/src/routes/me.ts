import { Router } from 'express';
import { requireAuth } from '@clerk/express';
import { prisma } from '../db';
import { validate } from '../middleware/validate';
import { getClerkId, ensureDbUser, requireAuthMw, type AuthedRequest } from '../middleware/auth';
import { updateMeSchema } from '../lib/validation/me';

const router = Router();

// GET /api/me — the current user's local profile (protected).
router.get('/me', requireAuth(), async (req, res) => {
  const clerkId = getClerkId(req);
  const user = await ensureDbUser(clerkId);
  res.json({
    id: user.id,
    role: user.role,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  });
});

// PATCH /api/me — update the current user's display name. Same shape as GET.
router.patch('/me', requireAuthMw, validate(updateMeSchema), async (req, res) => {
  const { displayName } = req.body as { displayName: string };
  const dbUser = (req as AuthedRequest).dbUser!;

  const user = await prisma.user.update({
    where: { id: dbUser.id },
    data: { displayName },
  });

  res.json({
    id: user.id,
    role: user.role,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  });
});

export default router;
