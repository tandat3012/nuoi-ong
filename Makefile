.DEFAULT_GOAL := help

# Run from the repository root. pnpm uses each application's own scripts/env.
PNPM ?= pnpm
COMPOSE := docker compose -f compose.yaml

.PHONY: help fe be db-up db-down db-migrate db-seed db-reset

help:
	@printf '%s\n' \
	  'make fe          Start Next.js development server' \
	  'make be          Start NestJS development server' \
	  'make db-up       Start PostgreSQL and wait until healthy' \
	  'make db-down     Stop PostgreSQL, preserving local data' \
	  'make db-migrate  Apply migrations using api/.env' \
	  'make db-seed     Seed local data using api/.env' \
	  'make db-reset    Delete the local nuoi_ong database and recreate it (confirmation required)' \
	  'After db-reset, run make db-migrate and make db-seed.' \
	  'Prerequisites: dependencies installed, root .env and api/.env configured.' \
	  'Host DATABASE_URL should point to localhost:5435/nuoi_ong.'

fe:
	$(PNPM) --dir web dev

be:
	$(PNPM) --dir api start:dev

db-up:
	$(COMPOSE) up -d --wait postgres

db-down:
	$(COMPOSE) stop postgres

db-migrate:
	$(PNPM) --dir api db:migrate

db-seed:
	$(PNPM) --dir api db:seed

# Only the fixed local database inside the Compose postgres service is reset.
# No volume deletion, no external DATABASE_URL, no automatic seeding.
# Stop API/dev processes first so they do not reconnect during reset.
db-reset:
	@printf '%s\n' 'WARNING: This permanently deletes data in the local nuoi_ong database.' 'Stop the API/dev processes before continuing.'
	@printf 'Type nuoi_ong to confirm: '; \
	read -r confirmation; \
	if [ "$$confirmation" != 'nuoi_ong' ]; then \
	  printf '%s\n' 'Reset cancelled.'; exit 1; \
	fi
	$(COMPOSE) up -d --wait postgres
	$(COMPOSE) exec -T postgres dropdb --username=postgres --force --if-exists nuoi_ong
	$(COMPOSE) exec -T postgres createdb --username=postgres --owner=postgres nuoi_ong
	@printf '%s\n' 'Local database recreated. Run make db-migrate, then make db-seed.'
