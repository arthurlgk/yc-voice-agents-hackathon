"""Process-cached async Supabase client.

The hackathon agent writes orders and call records to the staging project, which
requires the server-side secret key (anon is read-only under RLS).
"""

import asyncio
import logging
import os

from supabase._async.client import AsyncClient
from supabase._async.client import create_client as acreate_client

logger = logging.getLogger("restaurant.supabase")

_client: AsyncClient | None = None
_lock = asyncio.Lock()


async def get_client() -> AsyncClient:
    """Return the process-cached Supabase client, creating it on first use.

    Env vars are read lazily here (not at import time) so importing this module
    before ``.env`` is loaded does not blow up. ``SUPABASE_SECRET_KEY`` is
    required because the agent INSERTs into ``calls`` and ``orders``, which RLS
    blocks for the anon key.
    """
    global _client
    if _client is not None:
        return _client
    async with _lock:
        if _client is None:
            url = os.getenv("SUPABASE_URL", "http://127.0.0.1:54321")
            key = os.getenv("SUPABASE_SECRET_KEY")
            if not key:
                raise RuntimeError(
                    "SUPABASE_SECRET_KEY environment variable is required. "
                    "Set it in .env or your shell environment."
                )
            _client = await acreate_client(url, key)
    return _client


async def reset_client() -> None:
    """Close and drop the cached client.

    Supabase's ``AsyncClient`` wraps several httpx-backed sub-clients plus a
    realtime websocket; close each one we know about and ignore the ones the
    installed supabase-py version does not expose.
    """
    global _client
    client = _client
    _client = None
    if client is None:
        return

    for name in ("postgrest", "auth", "functions", "storage"):
        sub = getattr(client, name, None)
        aclose = getattr(sub, "aclose", None) if sub is not None else None
        if aclose is None:
            continue
        try:
            await aclose()
        except Exception:
            logger.exception("Failed to close Supabase %s transport", name)

    realtime = getattr(client, "realtime", None)
    if realtime is not None:
        close_fn = (
            getattr(realtime, "disconnect", None)
            or getattr(realtime, "aclose", None)
            or getattr(realtime, "close", None)
        )
        if close_fn is not None:
            try:
                await close_fn()
            except Exception:
                logger.exception("Failed to close Supabase realtime client")
