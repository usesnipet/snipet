# `migrations/`

Schema changes are **generated from `internal/model` by Atlas**, then
applied at boot with `golang-migrate`. `gorm.AutoMigrate` is never used —
see the `create-backend-module` skill's explicit "no AutoMigrate" rule.

## The two tools involved, and why both

- **[Atlas](https://atlasgo.io)** (`atlas.hcl`) diffs the *desired* schema
  (loaded by running `ariga.io/atlas-provider-gorm` against
  `internal/model`, see the `data "external_schema" "gorm"` block) against
  the *current* migration history, and writes the delta as a new
  `golang-migrate`-formatted migration pair. It needs a throwaway dev
  Postgres container (`dev = "docker://postgres/16/dev..."`) to compute the
  diff against.
- **[golang-migrate](https://github.com/golang-migrate/migrate)**
  (`internal/infra/database/migration.go`) is what actually runs migrations
  against the real database at process startup (`NewDatabase` →
  `runMigrations`, gated by `cfg.Database.AutoMigrate`) — a plain, dumb
  runner that doesn't know GORM exists.

Atlas is a generation-time tool for developers; golang-migrate is the
runtime dependency. This split is why a migration file, once generated,
must not depend on Atlas being available in production.

## Workflow for a schema change

Declarative in development, versioned at release: no migration file is
created while a version is being built — the local DB is synced straight
from the models, and one migration per version is generated when it ships.

### During development

1. Change the model in `internal/model/<entity>.go` (add a field, a table,
   an index, ...).
2. `make db-sync` — runs `atlas schema apply --env local`, which diffs the
   GORM schema against the DB at `DB_URL` and applies the delta after
   showing the plan. Data is kept. Decline the plan if it drops something
   you meant to rename (Atlas sees a rename as "drop + add").
   `schema_migrations` (golang-migrate's table) is excluded in `atlas.hcl`.

### Releasing a version

1. `make db-release <version> <name>` (e.g. `make db-release 0.0.3 agents`):
   runs `db-sync`, then `atlas migrate diff v<version>_<name>` to write the
   version's single `<timestamp>_v0_0_3_agents.{up,down}.sql` (and update
   `atlas.sum`), then `migrate force <timestamp>` to mark it applied on the
   local DB, whose schema already matches it.
2. Review the generated SQL. Atlas is schema-only, not data-aware: a
   rename comes out as "drop + add" (data loss) and needs to be rewritten
   into an `ALTER ... RENAME`; a new `not null` column on a table that
   already has rows generates a bare `ADD COLUMN ... NOT NULL` with no
   `DEFAULT` and no backfill, which fails against a populated table. Add the
   default/backfill by hand (an `UPDATE` between the `ADD COLUMN` and a
   follow-up `ALTER COLUMN ... SET NOT NULL`, or a `DEFAULT` if one value
   fits every existing row), then `make db-hash`.
3. Commit and tag. Anyone else whose DB was kept in step with `db-sync`
   runs `migrate -path migrations -database "$DB_URL" force <timestamp>`
   after pulling the release.

Migrations apply automatically the next time the app boots with
`DB_AUTO_MIGRATE` enabled (see [bootstrap.md](./bootstrap.md) /
`config/database.go`) — in production that is the only way schema changes.
`make db-generate <name>` is still there for an out-of-band migration
(e.g. a hotfix on a released version).

## File naming and shape

```
migrations/
  20260729152048_create_llms_table.up.sql
  20260729152048_create_llms_table.down.sql
  atlas.sum
```

- `<unix-ish timestamp>_<snake_case description>.{up,down}.sql` —
  golang-migrate's convention; the timestamp prefix is what snipets them.
- Every `.up.sql` has a matching `.down.sql` that reverses it exactly:
  ```sql
  -- up
  CREATE TABLE "llms" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "name" character varying(255) NOT NULL,
    "provider" character varying(255) NOT NULL,
    "configuration" jsonb NOT NULL,
    PRIMARY KEY ("id")
  );
  ```
  ```sql
  -- down
  DROP TABLE "llms";
  ```
- Migrations are never edited once they are in a release tag — a later
  change is a new migration, even to fix a mistake in an earlier one.

## Keeping models and migrations in sync

Because Atlas generates migrations *from* `internal/model`, the model
struct tags (`gorm:"type:...;not null;..."`, see [model.md](./model.md))
are the actual source of truth for schema — not something written once and
left to drift. Change the model first, then generate; never hand-write a
migration that the model doesn't already describe.
