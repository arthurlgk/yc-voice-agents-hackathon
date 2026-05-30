"""Lifecycle row writes for the ``calls`` table.

A new row is inserted when a caller connects (``insert_call_row``) and the same
row is updated with the end timestamp and duration when they disconnect
(``complete_call_row``). These are kept apart from order placement because they
write to a different table and run on different pipeline events; ``orders.py``
should be readable as "the place where order placement lives," nothing more.
"""

import logging
from datetime import UTC, datetime

from supabase._async.client import AsyncClient

logger = logging.getLogger("restaurant.calls")


async def insert_call_row(
    client: AsyncClient, call_id: str, restaurant_id: str, agent_id: str
) -> None:
    """Insert the active call record at the start of a session."""
    await (
        client.table("calls")
        .insert(
            {
                "id": call_id,
                "restaurant_id": restaurant_id,
                "agent_id": agent_id,
                "call_direction": "inbound",
                "started_at": datetime.now(UTC).isoformat(),
                "status": "active",
            }
        )
        .execute()
    )


async def complete_call_row(
    client: AsyncClient, call_id: str, started_at: datetime
) -> None:
    """Mark the call completed and record its duration at session end."""
    ended = datetime.now(UTC)
    await (
        client.table("calls")
        .update(
            {
                "ended_at": ended.isoformat(),
                "duration_seconds": int((ended - started_at).total_seconds()),
                "status": "completed",
            }
        )
        .eq("id", call_id)
        .execute()
    )
