# DRAFT — validate once Docker is available (`docker build`).
# Builds the static SPA with Bun + Vite, serves it with nginx.
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN bun install --frozen-lockfile
COPY tsconfig.base.json ./
COPY client ./client
# Vite inlines VITE_ vars at build time — pass them as build args.
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_API_BASE_URL
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN cd client && bun run build

FROM nginx:alpine AS runner
COPY --from=build /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
