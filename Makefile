.PHONY: test install dev-app build-app build-prod-app db-generate

GO ?= go
ATLAS ?= atlas
ATLAS_ENV ?= local

MIGRATION_NAME ?= $(strip $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS)))
RUN_ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
$(RUN_ARGS):
	@:

install:
	$(GO) install ./...

test:
	$(GO) test ./...

dev:
	air

build:
	$(GO) build -o ./tmp/api ./cmd/api

build-prod:
	$(GO) build -ldflags "-s -w" -o ./out/api-prod ./cmd/api

db-generate:
	@set -a && [ -f .env ] && . ./.env; set +a; \
	if [ -z "$(MIGRATION_NAME)" ]; then \
		echo 'usage: make db-generate <name>'; \
		echo '       make db-generate MIGRATION_NAME=<name>'; \
		exit 1; \
	fi; \
	$(ATLAS) migrate diff "$(MIGRATION_NAME)" --env $(ATLAS_ENV)
