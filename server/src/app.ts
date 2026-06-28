import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express';
import { env, serveClient } from './env';
import { errorHandler, notFound } from './middleware/error';
import healthRouter from './routes/health';
import forecastRouter from './routes/forecast';
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

  // Public, server-rendered forecast page. Mounted top-level (like /health),
  // OUTSIDE clerkMiddleware, so shared links open with no auth.
  app.use('/forecast', forecastRouter);

  // Clerk session middleware wraps the whole authenticated API surface once.
  // (Webhooks are mounted above, before this, so they stay outside it.)
  app.use('/api', clerkMiddleware());
  app.use('/api', meRouter);
  app.use('/api', picksRouter);
  app.use('/api/groups', groupsRouter);
  // The leaderboard paths don't collide with the routers above: Express matches
  // on the full path, and no route in groupsRouter (`/groups/:id`) or picksRouter
  // (`/elections/:id`) matches the extra `/leaderboard` segment. Mount order here
  // is therefore not load-bearing — it's kept tidy alongside the other /api routers.
  app.use('/api', leaderboardRouter);
  app.use('/api/admin', adminRouter);

  // Single-origin deploy (e.g. Railway): serve the built SPA and fall back to
  // index.html for client-side routes. Mounted AFTER /api, /health and
  // /forecast so those keep precedence; unknown /api/* paths still fall through
  // to the JSON 404 below. Off in dev/tests (Vite serves the client there).
  if (serveClient) {
    const clientDist =
      env.CLIENT_DIST ?? path.resolve(fileURLToPath(import.meta.url), '../../../client/dist');
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (
        req.path.startsWith('/api') ||
        req.path.startsWith('/health') ||
        req.path.startsWith('/forecast')
      ) {
        return next();
      }
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
