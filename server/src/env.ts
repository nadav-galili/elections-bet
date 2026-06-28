import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z
    .string()
    .default('postgresql://postgres:postgres@localhost:5432/elections_bet?schema=public'),
  // Required for auth to actually work; optional so the app can boot for /health and tests.
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().optional(),
  // When 'true', the API also serves the built SPA (single-service deploy,
  // e.g. Railway). Off by default so local dev (Vite on :5173) and tests are
  // unaffected. CLIENT_DIST overrides where the built client lives.
  SERVE_CLIENT: z.string().optional(),
  CLIENT_DIST: z.string().optional(),
});

export const env = schema.parse(process.env);

export const isProd = env.NODE_ENV === 'production';

/** Single-origin mode: serve client/dist from the API (set in the Docker image). */
export const serveClient = env.SERVE_CLIENT === 'true';
