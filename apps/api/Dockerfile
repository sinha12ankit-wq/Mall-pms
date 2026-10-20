# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @mall-pms/api...
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @mall-pms/api... build \
 && pnpm --filter @mall-pms/api deploy --prod --legacy /out

# One-shot image that applies migrations and the dev seed (used by docker compose).
FROM build AS migrate
WORKDIR /repo/packages/db
CMD ["sh", "-c", "pnpm migrate && pnpm seed"]

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out .
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
