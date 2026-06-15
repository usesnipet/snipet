.PHONY: test install dev build build-prod db-generate swagger

GO ?= go
ATLAS ?= atlas
ATLAS_ENV ?= local

MIGRATION_NAME ?= $(strip $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS)))
RUN_ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
$(RUN_ARGS):
	@:

install:
	$(GO) install ./...

dev:
	air

build:
	$(GO) build -o ./tmp/api ./cmd/api

build-prod:
	$(GO) build -ldflags "-s -w" -o ./out/api-prod ./cmd/api

swagger:
	@command -v swag >/dev/null 2>&1 || go install github.com/swaggo/swag/cmd/swag@latest
	swag init -g main.go -d cmd/api,internal/api,internal/module -o docs --parseDependency
	# $(GO) run ./tools/normalizeswagger ./docs
	cd web && pnpm codegen

db-generate:
	@set -a && [ -f .env ] && . ./.env; set +a; \
	if [ -z "$(MIGRATION_NAME)" ]; then \
		echo 'usage: make db-generate <name>'; \
		echo '       make db-generate MIGRATION_NAME=<name>'; \
		exit 1; \
	fi; \
	$(ATLAS) migrate diff "$(MIGRATION_NAME)" --env $(ATLAS_ENV)
