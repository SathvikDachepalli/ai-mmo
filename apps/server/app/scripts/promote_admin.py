"""One-off CLI: promote an account to superuser (admin panel access).

Usage:
    uv run python -m app.scripts.promote_admin someone@example.com
"""
import asyncio
import sys

from sqlalchemy import select

from app.db.models import User
from app.db.session import session_factory


async def promote(email: str) -> None:
    async with session_factory() as session:
        user = await session.scalar(select(User).where(User.email == email))
        if user is None:
            print(f"No account found for {email!r}. Register it in the app first, then rerun this.")
            return
        user.is_superuser = True
        await session.commit()
        print(f"{email} is now an admin.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: uv run python -m app.scripts.promote_admin <email>")
        raise SystemExit(1)
    asyncio.run(promote(sys.argv[1]))
