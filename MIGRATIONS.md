# Database Migrations

This project uses [Atlas](https://atlasgo.io/) to manage PostgreSQL schema changes. Migrations follow a **declarative workflow**: you edit GORM models in `internal/model/`, generate versioned migration files, and apply them to your database.

## How it works

### Declarative schema

GORM models in `internal/model/` are the source of truth for the database structure. Atlas reads them via the [atlas-provider-gorm](https://github.com/ariga/atlas-provider-gorm) and compares the desired state with the current migration history.

When you need a schema change:

1. Update the GORM structs in `internal/model/` (tags, fields, new models, etc.).
2. Run `make db-generate <name>` to compute the diff between the current migration history and the models.
3. Atlas writes paired `.up.sql` and `.down.sql` files into `migrations/`.

### Migration files

Migrations use the [golang-migrate](https://github.com/golang-migrate/migrate) format, configured in `atlas.hcl`:

| File | Purpose |
|------|---------|
| `<timestamp>_<name>.up.sql` | Applies the change |
| `<timestamp>_<name>.down.sql` | Reverts the change |
| `atlas.sum` | Integrity checksums for the migration directory |

Example:

```
migrations/
├── 20260612163733_initial.up.sql
├── 20260612163733_initial.down.sql
└── atlas.sum
```

Atlas tracks applied migrations in a revisions table on the target database. On apply, only `.up.sql` files are executed in timestamp order.

### Configuration

Project settings live in `atlas.hcl`:

```hcl
data "external_schema" "gorm" {
  program = [
    "go", "run", "-mod=mod",
    "ariga.io/atlas-provider-gorm",
    "load",
    "--path", "./internal/model",
    "--dialect", "postgres",
  ]
}

env "local" {
  src = data.external_schema.gorm.url
  dev = "docker://postgres/16/dev?search_path=public"
  migration {
    dir    = "file://migrations"
    format = golang-migrate
  }
}
```

- **src** — desired schema loaded from GORM models
- **dev** — ephemeral PostgreSQL 16 container used by Atlas to compute diffs (requires Docker)
- **migration.dir** — output directory for generated files
- **migration.format** — golang-migrate paired up/down files

The application reads the database URL from the `DB_URL` environment variable (see `config/database.go`). Use the same URL when applying migrations.

## Prerequisites

- [Atlas CLI](https://atlasgo.io/getting-started#installation) installed (`atlas` on your `PATH`)
- [Docker](https://www.docker.com/) running (required for `db-generate`, which spins up a temporary Postgres instance)
- A reachable PostgreSQL database for applying migrations

## Workflow

### 1. Change the models

Edit GORM structs in `internal/model/` to reflect the desired database structure.

### 2. Generate a migration

```bash
make db-generate add_users_role
```

This runs:

```bash
atlas migrate diff "<name>" --env local
```

Atlas compares the last applied migration state with your GORM models and creates new `.up.sql` / `.down.sql` files. Review the generated SQL before applying it.

### 3. Apply migrations

Point Atlas at your database and apply pending migrations:

```bash
export DB_URL="postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable"

atlas migrate apply --url "$DB_URL" --env local
```

Or load variables from `.env`:

```bash
set -a && source .env && set +a
atlas migrate apply --url "$DB_URL" --env local
```

Apply a specific number of migrations:

```bash
atlas migrate apply --url "$DB_URL" --env local 1
```

Preview SQL without executing:

```bash
atlas migrate apply --url "$DB_URL" --env local --dry-run
```

### 4. Check status

See which migrations are applied and which are pending:

```bash
atlas migrate status --url "$DB_URL" --env local
```

### 5. Roll back (optional)

Revert the last applied migration using the corresponding `.down.sql` file:

```bash
atlas migrate down --url "$DB_URL" --env local 1
```

Revert to a specific version:

```bash
atlas migrate down --url "$DB_URL" --env local --to-version 20260612163733
```

## Makefile reference

| Target | Description |
|--------|-------------|
| `make db-generate <name>` | Generate a new migration from changes in GORM models |

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `ATLAS` | `atlas` | Path to the Atlas CLI binary |
| `ATLAS_ENV` | `local` | Environment block in `atlas.hcl` |

## Common Atlas commands

| Command | Description |
|---------|-------------|
| `atlas schema inspect --env local --url "env://src"` | Inspect the schema derived from GORM models |
| `atlas migrate apply --url "$DB_URL" --env local` | Apply all pending migrations |
| `atlas migrate status --url "$DB_URL" --env local` | Show migration status |
| `atlas migrate down --url "$DB_URL" --env local 1` | Roll back one migration |
| `atlas migrate validate --env local` | Validate migration directory integrity |
| `atlas migrate hash --env local` | Recompute `atlas.sum` after manual edits |

## Tips

- **Always review** generated migration files before applying them to shared or production databases.
- **Add new models** to `internal/model/` with proper `gorm` tags; Atlas discovers them automatically.
- **Do not edit** `atlas.sum` manually; run `atlas migrate hash` if you change migration files by hand.
- **Commit** migration files and `atlas.sum` together so every environment applies the same history.
- If `migrate apply` fails with a checksum error, run `atlas migrate validate --env local` to inspect the migration directory.

## Troubleshooting

**`db-generate` fails with a Docker error**

Ensure Docker is running. Atlas needs a temporary Postgres container to compute schema diffs.

**`migrate apply` reports the directory is out of sync**

The contents of `migrations/` no longer match `atlas.sum`. Run `atlas migrate hash --env local` after fixing the files, or restore the checksum file from version control.

**Connection refused when applying**

Verify `DB_URL` points to a running PostgreSQL instance and that credentials, host, port, and database name are correct.
