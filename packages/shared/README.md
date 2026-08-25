# shared

Reserved package for cross-app type/contract definitions shared between the
Next.js frontend and the FastAPI backend (e.g. the wire shape of
`GameEvent`, `ActionProposal`).

Currently the two apps each declare their own equivalent types:
- `apps/web/app/lib/rt.ts` (frontend event summaries)
- `apps/server/app/events/models.py` (backend canonical events)

Move contracts here once a second consumer appears; do not add speculative
abstraction before one exists.