from __future__ import annotations

import logging

from agent_service.settings import settings

logger = logging.getLogger(__name__)

# Module-level singleton — initialized on first call to get_client().
try:
    from supabase import Client, create_client
    _supabase_available = True
except ImportError:
    _supabase_available = False
    Client = None  # type: ignore[assignment,misc]

_client: "Client | None" = None


def get_client() -> "Client | None":
    """Return the Supabase client, or None if creds are missing (audit disabled)."""
    global _client
    if _client is not None:
        return _client
    if not _supabase_available:
        return None
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return None
    _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    return _client


def insert_trace(
    chat_id: str,
    node_name: str,
    model: str,
    prompt_system: str | None,
    prompt_user: str | None,
    response: str | None,
    latency_ms: int,
    error: str | None = None,
) -> None:
    """Fire-and-forget insert into node_traces. Never raises."""
    client = get_client()
    logger.info("[trace.insert] node=%s chat_id=%s client=%s", node_name, chat_id, client is not None)
    if client is None or not chat_id:
        return
    try:
        res = client.table("node_traces").insert({
            "chat_id": chat_id,
            "node_name": node_name,
            "model": model,
            "prompt_system": prompt_system,
            "prompt_user": prompt_user,
            "response": response,
            "latency_ms": latency_ms,
            "error": error,
        }).execute()
        logger.info("[trace.insert] OK node=%s rows=%d", node_name, len(res.data or []))
    except Exception as e:
        logger.warning("[trace.insert] FAILED node=%s err=%s", node_name, e)
