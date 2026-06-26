# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**תחזית בחירות / Elections Bet** — a Hebrew, RTL, **points-only** (no money in the system) web app where friend-groups predict the Israeli Knesset mandate split and compete on per-group + global leaderboards.

**`implementation-plan.md` is the source of truth for product behavior and decisions.** Read it before implementing a feature. Work is sequenced in milestones M0–M7 (see §6); **M0 (foundation) is done**, the rest are not built yet. The full tech stack + versions live in **`tech-stack.md`**.

## Package manager & commands

**Bun is the package manager** (lockfile `bun.lock`) — never use `npm`/`yarn`/`pnpm`. The Node runtime still runs the server (via `tsx`); Bun is install + script runner. Run everything from the repo root unless noted.

```bash
bun install                              # install both workspaces
bun run dev                              # client :5173 + server :4000 together (concurrently)
bun run build                            # build both
bun run typecheck                        # tsc both workspaces
bun run lint                             # oxlint both
bun run test                             # Vitest (unit/component) both
bun run format                           # Prettier across the repo

# one workspace
bun run --filter client test
bun run --filter server test
# one test file / name pattern (args after `--` go to vitest)
bun run --filter server test -- src/app.test.ts
bun run --filter client test -- button
bun run --filter client test:watch

# database (server workspace)
docker compose -f server/docker-compose.yml up -d   # local Postgres
bun run --filter server db:migrate                  # create + apply a migration (dev)
bun run --filter server db:generate                 # regenerate Prisma client after schema edits
bun run --filter server db:studio
```

E2E (`client/e2e/*.spec.ts`, Playwright) is run via the `compound-engineering:playwright-test` skill, not a root script. We favor unit/component tests over E2E.

**Pre-commit** (husky, `.husky/pre-commit`) runs `lint-staged` (Prettier) → `bun run typecheck` → `bun run test` on every commit. A commit that fails typecheck or tests is rejected.

## Environment / running locally

A live dev run needs two things that aren't in the repo: **Clerk keys** and a **Postgres URL**. Copy `.env.example` into `server/.env` and `client/.env` and fill them. If `VITE_CLERK_PUBLISHABLE_KEY` is missing the client renders a "missing config" screen (it used to throw → blank page). Client env vars **must** be `VITE_`-prefixed; the server loads `.env` via `tsx --env-file` in dev (and validates it in `server/src/env.ts`, where Clerk keys are optional so `/health` and tests still boot).

## Architecture (the non-obvious wiring)

Bun-workspace monorepo: **`client/`** (Vite React SPA) and **`server/`** (Express REST API), decoupled. The client calls the server at `VITE_API_BASE_URL` with a Clerk bearer token attached by `useApi()` (`client/src/lib/api.ts`); the server verifies it with `@clerk/express`.

**Auth (Clerk) — `clerkMiddleware()` is scoped to `/api` only, not global.** This matters: `/health` and `/api/webhooks` must stay _outside_ it (mounting order in `server/src/app.ts` is deliberate — the webhook router is mounted before `express.json()` because it needs the raw body for signature verification). `requireAuth()` guards protected routes. Users are mirrored into Postgres by the Clerk webhook (`server/src/routes/webhooks.ts`), with `ensureDbUser()` (`server/src/middleware/auth.ts`) as a first-request fallback. A `role` flag (`USER` / `SUPER_ADMIN`) gates the admin surface.

**Express 5 error handling — do not write `try/catch` in route handlers.** Express 5 auto-forwards rejected promises to the central error middleware (`server/src/middleware/error.ts`). Throw `HttpError(status, message)` for a controlled status; anything else becomes 500.

**Prisma 7 (the big gotcha).** The datasource in `server/prisma/schema.prisma` has **no `url`** — the connection URL lives in `server/prisma.config.ts` (which loads `dotenv` itself) for the CLI, and the client is constructed with the **`@prisma/adapter-pg` driver adapter** in `server/src/db.ts`. After any schema change, run `db:generate`. The data model (User, Election, Party, Pick, PickEntry, Score, Group, GroupMembership) is in the schema; picks & scores are global per `(user, election)`, groups are membership views.

**Frontend.** Tailwind **v4** — no `tailwind.config`; the theme is defined with `@theme inline` + CSS variables in `client/src/index.css`. shadcn/ui (`components.json`, new-york, neutral) with the `@/*` → `src/*` alias (set in both `vite.config.ts` and `tsconfig`, **baseUrl-free** for TS 6). RTL Hebrew is global (`index.html` `lang="he" dir="rtl"`, `html { direction: rtl }`). Auth uses `@clerk/react` v6 (the `<Show>` component, not `SignedIn`/`SignedOut`). See **`tech-stack.md`** for the full library list and versions.

## Domain rules that code must enforce

These come from `implementation-plan.md` and are easy to get wrong:

- A pick is **mandates per party**; each value is **`0` or `4–120`** (never 1/2/3 — the 3.25% threshold means the real minimum is 4 seats), and the whole pick totals **exactly 120**.
- **One pick per `(user, election)`**, mirrored read-only into every group; there are no per-group picks.
- Score = `240 − Σ|predicted − actual|` + three bonuses (largest party, threshold accuracy, 3-way bloc outcome). Keep it a single pluggable function.
- Timeline: lock (default 20:00) freezes picks → **picks reveal on a timer** (default 20:02) with no scores → **scores reveal only when the admin publishes results**. "Picks hidden until reveal" is enforced in the API layer (no DB RLS).
