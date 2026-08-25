"""Socket.IO authentication: validate the same JWT issued by /auth/jwt/login.

A socket connection without a valid bearer token is refused, so a world room
only ever contains authenticated accounts.
"""
import uuid

from app.config import get_settings
from app.db.models import User


async def user_id_from_token(token: str | None) -> uuid.UUID | None:
    """Decode a fastapi-users JWT and return the account id, or None."""
    if not token:
        return None
    from fastapi_users.authentication import JWTStrategy
    from fastapi_users.jwt import decode_jwt

    settings = get_settings()
    try:
        payload = decode_jwt(token, settings.auth_secret, audience=["fastapi-users:auth"])
    except Exception:
        return None
    sub = payload.get("sub")
    try:
        return uuid.UUID(sub)
    except (TypeError, ValueError):
        return None


async def account_from_token(token: str | None):
    """Return the User row for a socket-supplied JWT, or None."""
    uid = await user_id_from_token(token)
    if uid is None:
        return None
    from app.db.session import session_factory

    async with session_factory() as session:
        user = await session.get(User, uid)
        if user is None or not user.is_active:
            return None
        # Detach so it survives session close.
        session.expunge(user)
        return user