import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 moves the Migrate/CLI connection URL out of schema.prisma into here.
// .env is loaded explicitly above (config files disable Prisma's auto .env loading).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
