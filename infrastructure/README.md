# Infrastructure

Docker Compose provides the two shared services the backend needs:

- **PostgreSQL** (`pgvector/pgvector:pg16`) — relational state + JSONB, with
  pgvector available for future embeddings. Listens on `5432` by default.
- **Redis** (`redis:7-alpine`) — reserved for the ARQ worker queue / pub-sub
  layer that will replace the in-process per-world lock once the game moves to
  distributed event processing. Listens on `6379`.

The frontend and backend dev servers run natively (see the root README) so you
get hot reload and a fast iteration loop; only Postgres/Redis are containerized.

## Start / stop

```bash
docker compose up -d        # start Postgres + Redis
docker compose down         # stop containers (data persists in the pgdata volume)
```

## No Docker? Run Postgres directly

If Docker isn't available (e.g. a local Postgres.app, or a homebrew cluster),
point the backend at your Postgres instead:

1. Create the role and database:
   ```sql
   CREATE ROLE rpg LOGIN PASSWORD 'rpg' SUPERUSER;
   CREATE DATABASE rpg OWNER rpg;
   ```
2. Set `DATABASE_URL` / `DATABASE_URL_SYNC` in `apps/server/.env` to your
   instance (host, port, credentials). For example, a second homebrew cluster
   on port `5433` uses `...@localhost:5433/rpg`.
3. Run migrations and seed (see root `Makefile`).

The project does not assume a specific Postgres install location or port —
everything flows through the two `DATABASE_URL*` environment variables.