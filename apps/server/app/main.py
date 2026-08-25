"""FastAPI entrypoint mounting the Socket.IO ASGI app and REST routes."""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.keepalive import keepalive_loop
from app.realtime.manager import init_manager
from app.realtime.socket_server import make_app, sio

init_manager()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(keepalive_loop())
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(title="ai-mmo-server", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/socket.io", make_app())

from app.api.auth.users import build_auth_routes  # noqa: E402

build_auth_routes(app)

from app.api.routes.ai_models import router as ai_models_router  # noqa: E402
from app.api.routes.rooms import router as rooms_router  # noqa: E402
from app.api.routes.admin import router as admin_router  # noqa: E402

app.include_router(ai_models_router)
app.include_router(rooms_router)
app.include_router(admin_router)

# Root sanity endpoint.
@app.get("/")
async def root() -> dict:
    return {
        "app": settings.app_name,
        "realtime": "socket.io mounted at /socket.io",
        "ai_provider": settings.ai_provider,
        "model": settings.ai_model,
    }


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok"}