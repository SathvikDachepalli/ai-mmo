# AI-Native Multiplayer Text RPG

Multiple players interact with the same persistent, AI-controlled world in real
time through a shared text interface. Players may be in the same or different
locations; their actions change one shared world state. The AI interprets
natural language, controls NPCs, and narrates — but **never owns canonical
state**. A deterministic game engine validates and applies every change.

## The core invariant

```
Player Input
    ↓
Intent Interpretation  (AI proposes)
    ↓
Structured Action Proposal
    ↓
Action Validation      (game engine)
    ↓
Deterministic Reducers (game engine)
    ↓
Canonical Events + Sequence Numbers
    ↓
Database State Update  (game engine)
    ↓
AI Narration           (AI renders, never invents state)
    ↓
Realtime Broadcast
```

The AI may interpret, propose, narrate, and drive high-level NPC behavior. All
canonical state mutations run through the engine and are recorded as ordered
`GameEvent`s, so the database can reconstruct world state from event history.

## Repository layout

```
ai-mmo/
├── apps/
│   ├── web/                  # Next.js 15 + TypeScript + Tailwind + Zustand +
│   │                         #   Socket.IO client + Framer Motion
│   └── server/               # FastAPI + python-socketio + SQLAlchemy 2.x
├── packages/shared/          # (reserved) shared type contracts
├── infrastructure/           # Docker Compose (Postgres + Redis) + README
├── README.md
├── .env.example
└── Makefile
```

### Backend modules (`apps/server/app`)

| Module | Responsibility |
|---|---|
| `game_engine/` | Pure validation + reduction; the only state authority |
| `ai/`          | Provider abstraction, intent interpreter, narrator, NPC |
| `world/`       | Models, connection service, DB state snapshot loader |
| `realtime/`    | Socket.IO server, world rooms, presence, broadcasting |
| `events/`      | Canonial event model, persistence, sequence numbers |
| `db/`          | SQLAlchemy models, repositories, async session |
| `workers/`     | (reserved) ARQ tasks for the future distributed processing |

## Local setup

### 1. Infrastructure (Postgres + Redis)

```bash
docker compose -f infrastructure/docker-compose.yml up -d
```

No Docker? See `infrastructure/README.md` for running Postgres directly and
pointing the app at it.

### 2. Backend

```bash
cd apps/server
uv sync                     # create .venv + install deps from pyproject.toml
cp .env.example .env        # adjust URLs/ports for your Postgres
uv run python -m alembic upgrade head    # create schema
uv run python -m app.world.seed          # seed the Blackwood world
uv run uvicorn app.main:app --reload --port 8000
```

Requires [uv](https://docs.astral.sh/uv/) (`uv run` also reads `.env`). To use a
classic venv instead, replace every `uv run` below with the venv's `python`.

### 3. Frontend

```bash
cd apps/web
npm install
npm run dev                   # http://localhost:3000
```

Open `http://localhost:3000` in **two browser tabs/windows**, enter two
different character names, and start playing. Both share the Blackwood world.

## Env config

Copy `.env.example` to `apps/server/.env` (backend) and copy the socket URL to
`apps/web/.env.local` (frontend). Relevant variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` / `DATABASE_URL_SYNC` | Async + sync Postgres connection strings |
| `REDIS_URL` | Redis for workers/queue |
| `AI_PROVIDER` | `openai` (real model) or `deterministic` (offline) |
| `AI_MODEL` | Model id, e.g. `deepseek-chat` for DeepSeek |
| `AI_API_KEY` | Provider key |
| `AI_BASE_URL` | OpenAI-compatible base URL (e.g. DeepSeek's `/v1`) |
| `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_SOCKET_URL` | Where the frontend connects |

To run with a real model: set `AI_PROVIDER` to one of `openrouter`,
`openai`, `deepseek`, or `ollama`, plus `AI_MODEL` and `AI_API_KEY`.
OpenRouter example:

```env
AI_PROVIDER=openrouter
AI_MODEL=deepseek/deepseek-chat-v3.1:free   # or anthropic/claude-sonnet-4.5
AI_API_KEY=sk-or-...
```

Each preset has a default base URL (openrouter -> https://openrouter.ai/api/v1);
override with `AI_BASE_URL`. With `AI_PROVIDER=deterministic` or a missing key,
intent and narration become rule-based so the demo runs fully offline — if a
live provider call fails mid-game, the app falls back per-call rather than
crashing. The provider layer (`app/ai/providers/`) is deliberately thin.

## Accounts & login

The world is only enterable by authenticated accounts (fastapi-users + JWT):

- `POST /auth/register` `{email, password, display_name}`
- `POST /auth/jwt/login` form-encoded `username=<email>&password=...` -> `{access_token}`
- `GET /users/me` bearer token -> account profile

The browser stores the JWT in localStorage; Socket.IO connections must present
it in the handshake auth (`{world, token}`), and the server refuses invalid or
missing tokens. Each account gets one character per world, resolved on first
connect. Set `AUTH_SECRET` in production (generate with `openssl rand -hex 32`).

## Makefile commands

```bash
make infra-up    # start postgres + redis
make dev         # print how to run backend/frontend
make backend     # run the FastAPI dev server on :8000
make frontend    # run the Next.js dev server on :3000
make migrate     # apply alembic migrations
make seed        # apply migrations then seed Blackwood
make test        # run the pytest suite
```

## Demo walkthrough

With two players connected:

```
Player A: I walk into the forest.
Player B: I enter the tavern.
AI:       Player A steps beneath the pines as Player B slips into the warm tavern.
Player A: I inspect the trees.
Player B: I ask Marek if he has seen Player A.
NPC:      Marek narrows his eyes. "Forest. That's where he said he was going."
```

Behind the scenes each `player_input` is interpreted, validated against the
canonical world snapshot, applied transactionally with a per-world sequence
number, broadcast with server-side visibility checks, then narrated.

## Visibility model

Events carry one of `PUBLIC | REGION | LOCATION | PARTY | PRIVATE`.
Visibility is enforced server-side before broadcast — a `PRIVATE` event (e.g.
an `INSPECT` room description) reaches only its actor; `LOCATION` events reach
players physically present with the actor; `REGION` events reach everyone in
the same region (fallback: same physical location).

## Concurrency

Each world serializes action processing through an in-process asyncio lock
(`app/game_engine/engine.py::WorldQueue`). The writer path uses a per-world
canonical `sequence` counter, never timestamps, for ordering. This is the
single-process (modular monolith) design; the lock boundary + Redis/ARQ worker
scaffolding is in place so it can evolve into distributed event processing
without changing the engine → broadcast interface.

## Known limitations

- **Single process**: the realtime layer keeps connection state in memory. Run
  exactly one backend for multi-player sessions. Moving to the Redis/ARQ
  worker pool requires sharding connection presence.
- **Deterministic provider**: without an API key the world is playable but
  narration is templated, not model prose.
- **Inspect-only for "look at trees"**: PICK_UP / DROP / USE / ATTACK are
  schemas plus validation, but without persistent item-in-room mutation yet —
  items exist and are locatable, but item-acquisition is not wired into the
  engine as a standalone reducer yet.
- **No auth**: character identity is name-scoped to a world (suitable for a
  local demo; not hardened).

## Recommended next steps

- Wire PICK_UP / DROP / USE into the engine reducers with inventory mutations
  (schema + validation stubs already exist in `game_engine/actions/schemas.py`).
- Ship the Redis-backed ARQ worker so `process_action` and narration fan out
  under concurrency.
- Add a REST auth layer (login → token → connect) decoupled from character
  name.
- Give players `PlayerKnowledge` rows on SECRET_DISCOVERED / NPC dialogue to
  build per-player memory.
- Connect the OpenAI-compatible narrator end to end with a key and test
  streaming latency.
- Build a world admin surface to inspect the event log and replay a world from
  its `GameEvent` history.