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

1. Change the model in `internal/model/<entity>.go` (add a field, a table,
   an index, ...).
2. `make db-generate <name>` — runs `atlas migrate diff <name> --env local`,
   which loads the new GORM schema, diffs it against `migrations/`, and
   writes `<timestamp>_<name>.up.sql` + `.down.sql`.
3. Review the generated SQL — Atlas is usually right, but a rename Atlas
   sees as "drop + add" (data loss) needs to be corrected by hand into an
   actual `ALTER ... RENAME`. Atlas is also schema-only, not data-aware: a
   new `not null` column on a table that already has rows generates a bare
   `ADD COLUMN ... NOT NULL` with no `DEFAULT` and no backfill — that fails
   against a populated table. Add the default/backfill by hand (an `UPDATE`
   between the `ADD COLUMN` and a follow-up `ALTER COLUMN ... SET NOT NULL`,
   or a `DEFAULT` if one value fits every existing row) whenever the target
   table isn't empty.
4. `make db-hash` — updates `migrations/atlas.sum`, the checksum file Atlas
   uses to detect manual edits to already-applied migrations.
5. Migrations apply automatically the next time the app boots with
   `DB_AUTO_MIGRATE` enabled (see [bootstrap.md](./bootstrap.md) /
   `config/database.go`).

## File naming and shape

```
migrations/
  20260729152048_create_llms_table.up.sql
  20260729152048_create_llms_table.down.sql
  atlas.sum
```

- `<unix-ish timestamp>_<snake_case description>.{up,down}.sql` —
  golang-migrate's convention; the timestamp prefix is what orders them.
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
- Migrations are never edited after being committed/applied — a later
  change is a new migration, even to fix a mistake in an earlier one.

## Keeping models and migrations in sync

Because Atlas generates migrations *from* `internal/model`, the model
struct tags (`gorm:"type:...;not null;..."`, see [model.md](./model.md))
are the actual source of truth for schema — not something written once and
left to drift. Change the model first, then generate; never hand-write a
migration that the model doesn't already describe.
