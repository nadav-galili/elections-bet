# Deploying to Railway

This app deploys to [Railway](https://railway.com) as a **single service**: the
Express API also serves the built React SPA and the server-rendered `/forecast`
page, so the REST API, the SSR forecast/unfurl page, and the client app all live
on **one origin**.

Everything below has been verified by building the image (`docker build`) and
booting it against a throwaway Postgres (migrations apply, all surfaces serve,
the OG PNG renders on Linux).

---

## Architecture

```
Railway service (Dockerfile) ──┬─ /api/*       → Express REST API (Clerk-guarded)
                               ├─ /api/webhooks→ Clerk webhook (raw body, no auth)
                               ├─ /health      → health check
                               ├─ /forecast*   → server-rendered page + og.png (public)
                               └─ /*           → client/dist SPA + index.html fallback

Railway Postgres plugin ───────── DATABASE_URL
```

- **One origin** → no CORS, the SPA calls the API with relative paths.
- The build is driven by the root [`Dockerfile`](../Dockerfile); Railway is told
  to use it by [`railway.json`](../railway.json).
- On boot the container runs `prisma migrate deploy` and then starts the server.

---

## Prerequisites

- A [Clerk](https://clerk.com) application (you need its publishable key, secret
  key, and a webhook signing secret).
- This repo pushed to GitHub (Railway deploys from the repo).

---

## One-time setup

### 1. Create the project + database

1. Railway → **New Project** → **Deploy from GitHub repo** → pick this repo.
2. In the project, **+ New** → **Database** → **Add PostgreSQL**.

### 2. Configure the service variables

Open the app service → **Variables** and set:

| Variable                       | Value                        | Notes                                   |
| ------------------------------ | ---------------------------- | --------------------------------------- |
| `DATABASE_URL`                 | `${{Postgres.DATABASE_URL}}` | Reference the Postgres plugin variable. |
| `CLERK_SECRET_KEY`             | `sk_live_…`                  | From Clerk → API Keys.                  |
| `CLERK_WEBHOOK_SIGNING_SECRET` | `whsec_…`                    | Created in step 4.                      |

> `PORT` and `NODE_ENV` are provided by Railway / the image — don't set them.
> `SERVE_CLIENT=true` and `CLIENT_DIST` are baked into the image.

### 3. Configure the **build args** (important — Vite inlines these at build time)

The client bundle reads `VITE_*` variables **when it is built**, not at runtime.
In Railway: app service → **Settings → Build → Build-time Variables** (a.k.a.
build args) and set:

| Build arg                    | Value            | Notes                                                 |
| ---------------------------- | ---------------- | ----------------------------------------------------- |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_…`      | Public key — safe to ship to the browser.             |
| `VITE_API_BASE_URL`          | _(empty string)_ | Empty → the SPA calls the API on the **same origin**. |

> If you set these as plain runtime variables instead of build args, the client
> will be built without them and show the "missing Clerk key" screen.

### 4. Deploy, then wire up Clerk

1. Trigger a deploy (Railway auto-deploys on push to the default branch).
2. Once it's live, copy the public domain (Settings → **Networking** → Generate
   Domain), e.g. `https://elections-bet-production.up.railway.app`.
3. In **Clerk → Webhooks**, add an endpoint:
   `https://<your-domain>/api/webhooks`
   Subscribe to the user events the app mirrors (`user.created`, `user.updated`,
   `user.deleted`). Copy the **Signing Secret** into `CLERK_WEBHOOK_SIGNING_SECRET`
   (step 2) and redeploy.
4. In **Clerk → Domains / allowed origins**, add `https://<your-domain>`.

### 5. Make yourself super-admin (optional)

Roles default to `USER`. To grant `SUPER_ADMIN`, connect to the Railway Postgres
(the plugin exposes a connection string) and update your row, or run the existing
script with the production `DATABASE_URL`:

```bash
DATABASE_URL="<railway postgres url>" bun run --filter server db:make-admin -- <your-email>
```

---

## Verifying a deploy

```bash
DOMAIN=https://<your-domain>
curl -sf $DOMAIN/health                       # → 200
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" $DOMAIN/forecast   # → 200 text/html
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" $DOMAIN/           # → 200 text/html (SPA)
```

- `/forecast/og.png` returns **404 until there is a forecast snapshot with data**
  (it's generated when the snapshot is computed for an active election). This is
  expected on a fresh database.
- Paste `$DOMAIN/forecast` into WhatsApp/Telegram/X to confirm the OG card unfurls.

---

## Operational notes & constraints

- **Keep it at 1 replica.** The `ForecastSnapshot` refresh uses an **in-process**
  single-flight lock (a module-level `Map`). It does not coordinate across
  instances, so scaling to multiple replicas would let several recompute at once.
  Moving to multi-instance requires a shared lock (e.g. a Postgres advisory lock).
- **Migrations run on boot** via `prisma migrate deploy` in the container start
  command. With a single instance this is safe. If you ever run >1 replica, move
  migrations to a Railway **pre-deploy / release command** so they run once.
- **Runtime DB access** goes through the `@prisma/adapter-pg` (pure-JS `pg`)
  driver; the Prisma **migration** engine needs OpenSSL, which the Dockerfile
  installs on the `node:22-slim` runner.
- **Native dependency:** `@resvg/resvg-js` (OG image rendering) ships a
  `linux-x64-gnu` prebuilt binary; it's resolved during `bun install` and verified
  to render on the Debian/glibc runner. If you change the base image, re-verify it.
- **The server runs TypeScript via `tsx`** in production (no separate compile
  step); `bun` is used only to install dependencies and build the client.

---

## Local Docker test (optional)

Reproduce the Railway build/boot locally:

```bash
# Build (pass the public Clerk key + empty API base)
docker build -t elections-bet \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx \
  --build-arg VITE_API_BASE_URL="" .

# Throwaway Postgres + the app on a shared network
docker network create eb-net
docker run -d --name eb-pg --network eb-net \
  -e POSTGRES_USER=app -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=elections_bet \
  postgres:16-alpine
docker run -d --name eb-app --network eb-net -p 4100:4000 \
  -e DATABASE_URL="postgresql://app:secret@eb-pg:5432/elections_bet?schema=public" \
  elections-bet

curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4100/health   # → 200

# Cleanup
docker rm -f eb-app eb-pg && docker network rm eb-net
```

---

## Troubleshooting

| Symptom                                           | Likely cause / fix                                                                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Client shows "חסר מפתח Clerk" (missing Clerk key) | `VITE_CLERK_PUBLISHABLE_KEY` was not set as a **build arg**. Set it under Build-time Variables and redeploy.               |
| API calls 401/403 from the SPA                    | `CLERK_SECRET_KEY` missing/wrong, or the domain isn't in Clerk's allowed origins.                                          |
| New users don't appear in the DB                  | Clerk webhook not configured, wrong URL, or `CLERK_WEBHOOK_SIGNING_SECRET` mismatch. Webhook URL must be `…/api/webhooks`. |
| Boot crash: Prisma OpenSSL / `P1010`              | `DATABASE_URL` not set or unreachable. OpenSSL itself is installed in the image.                                           |
| `/forecast/og.png` is 404                         | No snapshot with data yet — expected until an active election has a computed forecast.                                     |
| Page works but assets 404                         | Stale build; trigger a fresh deploy.                                                                                       |
