import { Router } from 'express';
import { requireAuth } from '@clerk/express';
import { requireSuperAdminMw } from '../../middleware/auth';
import electionsRouter from './elections';

const router = Router();

// The whole admin surface requires a signed-in super-admin.
router.use(requireAuth(), requireSuperAdminMw);

router.use('/elections', electionsRouter);

export default router;
