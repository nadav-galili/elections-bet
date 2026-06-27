import express from 'express';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express';
import { env } from './env';
import { errorHandler, notFound } from './middleware/error';
import healthRouter from './routes/health';
import meRouter from './routes/me';
import picksRouter from './routes/picks';
import webhooksRouter from './routes/webhooks';
import adminRouter from './routes/admin';
import groupsRouter from './routes/groups';
import leaderboardRouter from './routes/leaderboard';

export function createApp() {
  const app = express();

  app.use(
    cors({
      // Allow the configured client, same-origin/non-browser requests (no Origin),
      // and any localhost port in dev (Vite may fall back 5173 → 5174 → …).
      origin: (origin, cb) => {
        const ok =
          !origin || origin === env.CLIENT_ORIGIN || /^https?:\/\/localhost:\d+$/.test(origin);
        cb(null, ok);
      },
      credentials: true,
    }),
  );

  // Webhooks need the raw body, so mount them before the JSON body parser
  // (and they verify their own signature, so no Clerk session middleware).
  app.use('/api/webhooks', webhooksRouter);

  app.use(express.json());

  app.use('/health', healthRouter);

  // Clerk session middleware wraps the whole authenticated API surface once.
  // (Webhooks are mounted above, before this, so they stay outside it.)
  app.use('/api', clerkMiddleware());
  app.use('/api', meRouter);
  app.use('/api', picksRouter);
  app.use('/api/groups', groupsRouter);
  // Mounted after groupsRouter so GET /api/groups/:id/leaderboard falls through
  // (groupsRouter has no :id/leaderboard route) to here. The /leaderboard suffix
  // keeps /elections/:id/leaderboard distinct from picksRouter's /elections/:id.
  app.use('/api', leaderboardRouter);
  app.use('/api/admin', adminRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
