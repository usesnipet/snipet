# The site (landing + docs) on Astro's standalone Node server.
# Build from the repo root: docker build -f apps/site/Dockerfile .

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

# A partial monorepo with only the site and its packages, and a lockfile pruned to match.
FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2.11.5 prune @snipet/site --docker

FROM base AS build
# Manifests first, so the install layer is cached until dependencies change.
COPY --from=prune /app/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=prune /app/out/full/ .
RUN pnpm turbo run build --filter @snipet/site
# Production dependencies only; the server bundle still imports some at runtime (sharp, react).
RUN pnpm --filter @snipet/site deploy --prod --legacy /out/site && cp -r apps/site/dist /out/site/dist

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321
COPY --from=build /out/site .
USER node
EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]
