# DRAFT — validate once Docker is available (`docker build`).
# Deps installed with Bun; server runs on Node via tsx (per the plan's Node runtime).
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN bun install --frozen-lockfile

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Workspace deps hoist to the repo root node_modules.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock tsconfig.base.json ./
COPY server ./server
WORKDIR /app/server
# Generate the Prisma client (URL is only needed at runtime, dummy is fine here).
RUN DATABASE_URL="postgresql://user:pass@localhost:5432/db" \
    ../node_modules/.bin/prisma generate
EXPOSE 4000
CMD ["../node_modules/.bin/tsx", "src/index.ts"]
