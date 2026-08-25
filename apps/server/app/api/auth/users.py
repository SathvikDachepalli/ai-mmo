"""Account system: fastapi-users with JWT bearer transport.

Accounts are global (one account -> many characters across worlds). The socket
layer validates the same JWT on connect, so a chat room is only enterable by an
authenticated client.
"""
import uuid

from fastapi import Depends
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin
from fastapi_users.authentication import (
    AuthenticationBackend,
    BearerTransport,
    JWTStrategy,
)
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.models import User
from app.db.session import get_session


# --- Schemas ---

class UserRead(BaseModel):
    id: uuid.UUID
    email: EmailStr
    is_active: bool = True
    is_superuser: bool = False
    display_name: str | None = None

    model_config = {"from_attributes": True}


from fastapi_users import schemas as fu_schemas


class UserCreate(fu_schemas.CreateUpdateDictModel, BaseModel):
    email: EmailStr
    password: str
    display_name: str | None = None


class UserUpdate(fu_schemas.CreateUpdateDictModel, BaseModel):
    password: str | None = None
    display_name: str | None = None
    email: EmailStr | None = None


# --- DB adapter / manager ---

async def get_user_db(
    session: AsyncSession = Depends(get_session),
):
    yield SQLAlchemyUserDatabase(session, User)


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = get_settings().auth_secret
    verification_token_secret = get_settings().auth_secret

    async def on_after_register(self, user, request=None):
        print(f"User {user.id} registered.")


async def get_user_manager(user_db=Depends(get_user_db)):
    yield UserManager(user_db)


# --- Auth backend (JWT bearer) ---

def _strategy() -> JWTStrategy:
    settings = get_settings()
    return JWTStrategy(secret=settings.auth_secret, lifetime_seconds=3600)


bearer_transport = BearerTransport(tokenUrl="auth/jwt/login")

auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=_strategy,
)

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

current_active_user = fastapi_users.current_user(active=True)
current_admin_user = fastapi_users.current_user(active=True, superuser=True)


# --- Routes to be mounted by main.py ---

def build_auth_routes(app):
    app.include_router(
        fastapi_users.get_auth_router(auth_backend),
        prefix="/auth/jwt",
        tags=["auth"],
    )
    app.include_router(
        fastapi_users.get_register_router(UserRead, UserCreate),
        prefix="/auth",
        tags=["auth"],
    )
    app.include_router(
        fastapi_users.get_users_router(UserRead, UserUpdate),
        prefix="/users",
        tags=["users"],
    )