# Tech Stack

The canonical list of technologies, libraries, and versions used in Elections Bet. This is the single source of truth for **what** we use; **`implementation-plan.md`** is the source of truth for product behavior, and **`CLAUDE.md`** explains the non-obvious wiring.

> Versions reflect the M0 install (2026-06-26) and use caret ranges; run `bun pm ls` for what's actually resolved.

## Tooling & runtime

| Tool                    | Version    | Role                                                                           |
| ----------------------- | ---------- | ------------------------------------------------------------------------------ |
| **Bun**                 | 1.2.x      | Package manager + script runner + Bun workspaces. **Never use npm/yarn/pnpm.** |
| **Node.js**             | 22         | Runtime for the server (via `tsx`); Bun does install/scripts only.             |
| **concurrently**        | 9.x        | Runs client + server together in `bun run dev`.                                |
| **Prettier**            | 3.x        | Formatting (config in `.prettierrc`).                                          |
| **oxlint**              | 1.x        | Linting (both workspaces).                                                     |
| **Husky + lint-staged** | 9.x / 16.x | Pre-commit: Prettier on staged files → `typecheck` → `test`.                   |
| **Docker + Railway**    | —          | Deploy (Dockerfiles are drafts; see `docs/DEPLOY.md`).                         |
| **Context7 (MCP)**      | —          | Pull current package docs at scaffold time, instead of relying on memory.      |

## Client (`client/`)

A Vite React SPA. Hebrew / RTL, web only (no native mobile).

| Library               | Version                             | Role                                                                                                                   |
| --------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **React / React DOM** | 19.2                                | UI.                                                                                                                    |
| **TypeScript**        | 6.0                                 | Types (path alias `@/*` → `src/*`, baseUrl-free).                                                                      |
| **Vite**              | 8.1                                 | Build/dev (`@vitejs/plugin-react` 6).                                                                                  |
| **Tailwind CSS**      | v4                                  | Styling via `@tailwindcss/vite` (no `tailwind.config`; theme in `src/index.css`). `tw-animate-css` for animations.     |
| **shadcn/ui**         | new-york / neutral                  | Components (`components.json`). Built on `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-slot`. |
| **React Router**      | `react-router-dom` 7                | Client-side routing.                                                                                                   |
| **TanStack Query**    | 5                                   | Server state, caching, loading state.                                                                                  |
| **TanStack Table**    | 8                                   | Sorting/filtering/pagination (leaderboards, admin lists).                                                              |
| **Axios**             | 1                                   | HTTP client (Clerk token attached in `src/lib/api.ts`).                                                                |
| **React Hook Form**   | 7                                   | Form state (`@hookform/resolvers` 5).                                                                                  |
| **Zod**               | 4                                   | Schema validation (shared concept with the API).                                                                       |
| **Lucide**            | `lucide-react` 1                    | Icons.                                                                                                                 |
| **Clerk**             | `@clerk/react` 6                    | Auth components/hooks. v6 uses `<Show when="signed-in/-out">` (not `SignedIn`/`SignedOut`).                            |
| **Clerk UI**          | `@clerk/ui` 1                       | shadcn theme for Clerk components (`appearance={{ theme: shadcn }}` + `@clerk/ui/themes/shadcn.css`).                  |
| **Beui**              | `github.com/starc007/ui-components` | Animated/motion components — **planned, not yet installed.**                                                           |

**Client testing:** Vitest 4 + React Testing Library 16 (`@testing-library/jest-dom`, `user-event`, `jsdom`, `@vitest/coverage-v8`); Playwright 1 for E2E (`client/e2e/`, run via the `compound-engineering:playwright-test` skill). Favor unit/component over E2E.

## Server (`server/`)

A decoupled Express REST API. Node runtime via `tsx`.

| Library        | Version            | Role                                                                                                                                                  |
| -------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Express**    | 5.2                | REST API. **No try/catch in async handlers** — rejected promises auto-forward to the central error middleware.                                        |
| **TypeScript** | 6.0                | Types.                                                                                                                                                |
| **tsx**        | 4.x                | Runs/​watches TS on Node (dev + prod start).                                                                                                          |
| **Prisma**     | 7                  | ORM (`@prisma/client` 7) + **`@prisma/adapter-pg` 7** driver adapter + `pg` 8. URL lives in `prisma.config.ts` (not the schema), loaded via `dotenv`. |
| **PostgreSQL** | —                  | Database (local via `server/docker-compose.yml`, prod on Railway).                                                                                    |
| **Clerk**      | `@clerk/express` 2 | Token verification (`clerkMiddleware`, `requireAuth`) + webhooks (`@clerk/express/webhooks`).                                                         |
| **Zod**        | 4                  | Env validation (`src/env.ts`) + request validation.                                                                                                   |
| **cors**       | 2                  | CORS for the cross-origin SPA.                                                                                                                        |

**Server testing:** Vitest 4 + supertest 7.

## Conventions worth knowing

- **Bun only** — never npm/yarn/pnpm; the lockfile is `bun.lock`.
- **Express 5** auto-forwards async errors to `server/src/middleware/error.ts`; throw `HttpError(status, message)`.
- **Prisma 7** needs `prisma.config.ts` + the pg driver adapter; run `db:generate` after schema edits.
- **Tailwind v4** has no config file; the theme is CSS variables + `@theme inline` in `client/src/index.css`.
- **`@clerk/react` v6** uses `<Show>`; the secret key lives **only** in `server/.env`, never in the client.
