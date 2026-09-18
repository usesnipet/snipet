.PHONY: test install dev dev-api dev-web build build-prod db-generate db-hash mocks fix swagger

GO ?= go
ATLAS ?= atlas
ATLAS_ENV ?= local
PNPM ?= pnpm
SWAG ?= $(GO) tool swag
AIR ?= $(GO) tool air

MIGRATION_NAME ?= $(strip $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS)))
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

fix:
	$(GO) fix ./...

openapi:
	$(SWAG) init -g cmd/api/main.go -o docs/swagger --parseDependency --parseInternal --useStructName
