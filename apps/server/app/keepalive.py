"""Self-ping loop so Render's free-tier web service doesn't spin down after
15 minutes of no inbound traffic. Render sets RENDER_EXTERNAL_URL on every
deployed service automatically -- this no-ops anywhere that isn't set (local
dev, other hosts), so nothing needs configuring by hand.
"""
import asyncio
import logging
import os

import httpx

logger = logging.getLogger(__name__)

PING_INTERVAL_SECONDS = 600  # well under the 15-minute idle timeout


async def keepalive_loop() -> None:
    url = os.environ.get("RENDER_EXTERNAL_URL")
    if not url:
        logger.info("RENDER_EXTERNAL_URL not set; keepalive ping disabled.")
        return
    target = f"{url.rstrip('/')}/api/health"
    logger.info("Keepalive ping enabled: %s every %ds", target, PING_INTERVAL_SECONDS)
    async with httpx.AsyncClient(timeout=10.0) as client:
        while True:
            await asyncio.sleep(PING_INTERVAL_SECONDS)
            try:
                await client.get(target)
            except Exception:
                logger.warning("Keepalive ping failed", exc_info=True)
