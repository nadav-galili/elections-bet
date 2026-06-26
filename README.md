# תחזית בחירות / Elections Bet

Hebrew, RTL, points-only web app where friend-groups predict the Knesset mandate split and compete on per-group + global leaderboards. Full spec: [`implementation-plan.md`](./implementation-plan.md).

## Stack

- **client/** — Vite + React + TS · Tailwind v4 + shadcn/ui · React Router · TanStack Query/Table · Axios · React Hook Form + Zod · Lucide
- **server/** — Express 5 + TS · Prisma · PostgreSQL · Clerk (`@clerk/express`)
- Single git repo, **Bun** package manager (Bun workspaces), `concurrently` dev. Node runtime. Docker on Railway.

## Getting started

```bash
nvm use            # Node 22 (runtime); Bun is the package manager
bun install        # installs both workspaces
cp .env.example server/.env   # then fill in Clerk keys + DATABASE_URL
cp .env.example client/.env
docker compose -f server/docker-compose.yml up -d   # local Postgres
bun run --filter server db:migrate
bun run dev        # client (5173) + server (4000) together
```

## Scripts (root)

| Script              | Does                                      |
| ------------------- | ----------------------------------------- |
| `bun run dev`       | client + server together via concurrently |
| `bun run build`     | build both workspaces                     |
| `bun run test`      | unit/component tests (Vitest) in both     |
| `bun run typecheck` | type-check both                           |
| `bun run lint`      | lint both                                 |
| `bun run format`    | Prettier across the repo                  |

E2E (Playwright) lives in `client/` and is run via the `compound-engineering:playwright-test` skill.
