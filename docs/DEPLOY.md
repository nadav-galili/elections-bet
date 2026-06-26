# Deploy (Railway)

> The Dockerfiles are **drafts** — validate with `docker build` once the Docker daemon is running.

Two Railway services from this one repo:

## API service (`server/`)

- Dockerfile: `server/Dockerfile`
- Env vars: `DATABASE_URL` (Railway Postgres plugin), `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `CLIENT_ORIGIN`, `PORT`
- Run migrations on deploy: `bun run --filter server db:deploy` (or `prisma migrate deploy`)
- Point the Clerk webhook at `https://<api-host>/api/webhooks/clerk`

## Web service (`client/`)

- Dockerfile: `client/Dockerfile`
- Build args: `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_BASE_URL` (the API service URL)
- Served by nginx with SPA fallback (`client/nginx.conf`)

## Local production-style build

```bash
docker compose -f server/docker-compose.yml up -d   # Postgres
docker build -t elections-api ./ -f server/Dockerfile
docker build -t elections-web ./ -f client/Dockerfile \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_... \
  --build-arg VITE_API_BASE_URL=http://localhost:4000
```
