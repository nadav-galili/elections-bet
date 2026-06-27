import express from 'express';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express';
import { env } from './env';
import { errorHandler, notFound } from './middleware/error';
import healthRouter from './routes/health';
import meRouter from './routes/me';
import webhooksRouter from './routes/webhooks';
import adminRouter from './routes/admin';
import groupsRouter from './routes/groups';

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
  app.use('/api/groups', groupsRouter);
  app.use('/api/admin', adminRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
