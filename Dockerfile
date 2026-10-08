# One image: the API serves the web app on the same port.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

# A partial monorepo with only the API, the web app and their packages, and a
# lockfile pruned to match: other workspaces (the widget) don't bust the cache.
FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2.11.5 prune @snipet/api @snipet/web --docker

FROM base AS build
# Manifests first, so the install layer is cached until dependencies change.
COPY --from=prune /app/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=prune /app/out/full/ .
RUN pnpm turbo run build
# The API with its production dependencies only, @snipet/shared included.
RUN pnpm --filter @snipet/api deploy --prod --legacy /out/api

FROM node:22-slim
WORKDIR /app
ARG APP_VERSION=dev
ENV NODE_ENV=production PORT=8080 APP_VERSION=$APP_VERSION WEB_DIR=/app/public
COPY --from=build /out/api .
COPY --from=build /app/apps/web/dist public
USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]
