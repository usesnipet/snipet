.PHONY: test install dev dev-api dev-web build build-prod db-generate db-hash db-sync db-release mocks fix swagger

GO ?= go
ATLAS ?= atlas
ATLAS_ENV ?= local
MIGRATE ?= migrate
PNPM ?= pnpm
SWAG ?= $(GO) tool swag
AIR ?= $(GO) tool air

MIGRATION_NAME ?= $(strip $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS)))
VERSION ?= $(word 2,$(MAKECMDGOALS))
NAME ?= $(word 3,$(MAKECMDGOALS))
RUN_ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
$(RUN_ARGS):
	@:

install:
	$(GO) install ./... && cd web && $(PNPM) install

test:
	$(GO) test ./...

mocks:
	$(GO) tool mockery

dev:
	$(MAKE) -j2 dev-api dev-web

dev-api:
	$(AIR)

dev-web:
	cd web && $(PNPM) dev

build:
	$(GO) build -o ./tmp/api ./cmd/api

build-prod:
	cd web && pnpm build && cd .. && $(GO) build -tags web -ldflags "-s -w" -o ./out/web-prod ./cmd/api

build-prod-api:
	$(GO) build -ldflags "-s -w" -o ./out/api-prod ./cmd/api

db-generate:
	@set -a && [ -f .env ] && . ./.env; set +a; \
	if [ -z "$(MIGRATION_NAME)" ]; then \
		echo 'usage: make db-generate <name>'; \
		echo '       make db-generate MIGRATION_NAME=<name>'; \
		exit 1; \
	fi; \
	$(ATLAS) migrate diff "$(MIGRATION_NAME)" --env $(ATLAS_ENV)


db-hash:
	$(ATLAS) migrate hash --env $(ATLAS_ENV)

# db-sync applies the models straight to the local DB (DB_URL), without a migration file.
db-sync:
	@set -a && [ -f .env ] && . ./.env; set +a; \
	$(ATLAS) schema apply --env $(ATLAS_ENV)

# db-release generates the version's single migration and marks it applied on the local DB.
db-release: db-sync
	@set -a && [ -f .env ] && . ./.env; set +a; \
	if [ -z "$(VERSION)" ] || [ -z "$(NAME)" ]; then \
		echo 'usage: make db-release <version> <name>'; \
		echo '       make db-release VERSION=<version> NAME=<name>'; \
		exit 1; \
	fi; \
	$(ATLAS) migrate diff "v$(subst .,_,$(VERSION))_$(NAME)" --env $(ATLAS_ENV) || exit 1; \
	new=$$(ls migrations/*.up.sql | tail -n 1 | xargs basename | cut -d_ -f1); \
	$(MIGRATE) -path migrations -database "$$DB_URL" force $$new || exit 1; \
	echo "local DB marked at $$new — review the generated SQL before committing"

fix:
	$(GO) fix ./...

openapi:
	$(SWAG) init -g cmd/api/main.go -o docs/swagger --parseDependency --parseInternal --useStructName
