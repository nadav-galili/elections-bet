import { Router } from 'express';
import { requireAuth } from '@clerk/express';
import { getClerkId, ensureDbUser } from '../middleware/auth';

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

export default router;
