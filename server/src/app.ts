import express from 'express';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express';
import { env } from './env';
import { errorHandler, notFound } from './middleware/error';
import healthRouter from './routes/health';
import meRouter from './routes/me';
import webhooksRouter from './routes/webhooks';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));

  // Webhooks need the raw body, so mount them before the JSON body parser
  // (and they verify their own signature, so no Clerk session middleware).
  app.use('/api/webhooks', webhooksRouter);

  app.use(express.json());

  app.use('/health', healthRouter);

  // Clerk session middleware wraps only the authenticated API surface.
  app.use('/api', clerkMiddleware(), meRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
