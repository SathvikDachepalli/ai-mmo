SHELL := /bin/bash

INFRA := infrastructure
BACKEND := apps/server
FRONTEND := apps/web
RUN := uv run

.PHONY: dev backend frontend migrate seed test infra-up infra-down reset

infra-up:
	docker compose -f $(INFRA)/docker-compose.yml up -d

infra-down:
	docker compose -f $(INFRA)/docker-compose.yml down

backend: infra-up
	cd $(BACKEND) && $(RUN) uvicorn app.main:app --reload --port 8000

frontend: infra-up
	cd $(FRONTEND) && npm run dev

migrate: infra-up
	cd $(BACKEND) && $(RUN) python -m alembic upgrade head

seed: migrate
	cd $(BACKEND) && $(RUN) python -m app.world.seed

test:
	cd $(BACKEND) && $(RUN) pytest

dev:
	@echo "Run backend:  make backend"
	@echo "Run frontend: make frontend"
	@echo "Open:        http://localhost:3000"