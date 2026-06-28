# Single-service image for Railway (or any Docker host): the Express API also
# serves the built React SPA, so /api, the SSR /forecast page, and the client
# app all live on one origin.
#
# Deps are installed with Bun; the server runs on Node via tsx (per the plan's
# Node runtime). The client is built with Vite — VITE_* vars are inlined at
# BUILD time, so they must be passed as --build-arg, not runtime env.

# ---- deps: install the whole workspace with Bun (frozen lockfile) ----
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN bun install --frozen-lockfile

# ---- build: compile the SPA and generate the Prisma client ----
FROM deps AS build
WORKDIR /app
COPY . .
# Vite inlines these into the client bundle at build time.
# Set VITE_API_BASE_URL="" so the SPA calls the API on the same origin.
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_API_BASE_URL=""
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN cd client && bun run build
# Generate the Prisma client (the real URL is only needed at runtime; the
# generator just needs *a* URL to be present — a dummy is fine here).
RUN cd server && DATABASE_URL="postgresql://u:p@localhost:5432/db" \
    ../node_modules/.bin/prisma generate

# ---- runner: Node 22 runtime ----
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV SERVE_CLIENT=true
ENV CLIENT_DIST=/app/client/dist
# Prisma's migration engine needs OpenSSL (node:*-slim ships without libssl).
# Runtime queries go through the pg driver adapter, but `migrate deploy` on
# boot uses the schema engine, which links libssl.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# node_modules carries the generated Prisma client + native binaries
# (@resvg/resvg-js); both deps and runner are Debian/glibc x64 so they match.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/bun.lock /app/tsconfig.base.json ./
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist
WORKDIR /app/server
# Railway injects PORT and DATABASE_URL. Apply pending migrations, then boot.
CMD ["sh", "-c", "../node_modules/.bin/prisma migrate deploy && exec ../node_modules/.bin/tsx src/index.ts"]
