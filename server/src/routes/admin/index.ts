import { Router } from 'express';
import { requireAuth } from '@clerk/express';
import { requireSuperAdminMw } from '../../middleware/auth';
import electionsRouter from './elections';
import groupsRouter from './groups';
import usersRouter from './users';
import overviewRouter from './overview';

const router = Router();

// The whole admin surface requires a signed-in super-admin.
router.use(requireAuth(), requireSuperAdminMw);

router.use('/elections', electionsRouter);
router.use('/groups', groupsRouter);
router.use('/users', usersRouter);
router.use('/overview', overviewRouter);

export default router;
