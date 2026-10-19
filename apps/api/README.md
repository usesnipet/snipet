# @snipet/api

The Snipet server: a NestJS API for agents, their runs and sessions, LLM and plugin connections,
apps and API keys. In production it also serves the [web app](../web) on the same port.

## Run

Needs Postgres. From the repo root:

```bash
cp .env.example .env    # read by the API from the repo root: set JWT_SECRET and DATABASE_URL
pnpm install
pnpm --filter @snipet/api dev                         # http://localhost:$PORT/api
```

On first start the API runs its migrations (`DB_AUTO_MIGRATE`) and creates the admin user
(`ROOT_USERNAME`; without `ROOT_PASSWORD` a random password is logged once).

`docker-compose.dev.yml` also builds the full image (`app` service), and `--profile dev` adds MinIO as
a local S3 for file storage.

## Configuration

Environment variables, all validated in [`src/env.ts`](src/env.ts) (each one is documented there).
The ones to set in production:

| Variable                      |                                                           |
| ----------------------------- | --------------------------------------------------------- |
| `DATABASE_URL`                | App database.                                             |
| `JWT_SECRET`                  | 32+ characters.                                           |
| `ENCRYPTION_KEY`              | 32 bytes, base64: encrypts stored credentials.            |
| `ROOT_PASSWORD`               | First admin's password.                                   |
| `PUBLIC_URL`                  | URL the server is reached at.                             |
| `CORS_ORIGINS`                | Sites embedding the widget, comma-separated.              |
| `TRUST_PROXY`                 | Behind a reverse proxy, so rate limits see the client IP. |
| `STORAGE_*`                   | Uploaded files.                                           |

## Scripts

```bash
pnpm dev                          # watch mode
pnpm build && pnpm start:prod     # dist/main.js
pnpm test                         # unit tests (jest)
pnpm test:e2e
pnpm migration:generate <Name>    # from the entities, into src/migrations
pnpm migration:run | migration:revert | migration:show
```

The `migration:*` scripts also run from the repo root.

## Layout

- `src/modules/<module>`: one folder per resource (entity, dto, service, controller, module).
  Scaffold a new one with the `create-module` skill (`.claude/skills/create-module`).
- `src/common`: auth guards and decorators (`@Public`, `@Private(UserAuth(), ApiKeyAuth(), AppTokenAuth())`).
- `src/llm`, `src/plugin`, `src/manifest`: LLM and plugin drivers, loaded from JSON manifests.
- `src/infra`: database and file storage.
- `src/migrations`: TypeORM migrations.

Request and response schemas live in [`@snipet/shared`](../../packages/shared); the generic CRUD
building blocks in [`@snipet/server-common`](../../packages/server-common).
