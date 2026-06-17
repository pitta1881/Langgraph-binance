from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from langchain_google_genai import ChatGoogleGenerativeAI

from ....settings import settings

if TYPE_CHECKING:
    from ....agents.shared.state import ChatState

logger = logging.getLogger(__name__)


def _llm(state: "ChatState | None" = None, temperature: float = 0.3) -> ChatGoogleGenerativeAI:
    model = (state or {}).get("model") or settings.AI_MODEL
    return ChatGoogleGenerativeAI(
        model=model,
        temperature=temperature,
        google_api_key=settings.AI_API_KEY,
    )


def _extract_text(response: Any) -> str:
    """Normalize the LLM response into a plain string.

    Newer versions of langchain-google-genai return `response.content` as a
    list of content blocks (e.g. ``[{'type': 'text', 'text': '...', 'extras': {...}}]``)
    instead of a plain string. Callers that just stringify the list end up
    leaking the raw Python repr into the UI. This helper handles both shapes.
    """
    content = getattr(response, "content", response)

    if isinstance(content, str):
        return content

    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict):
                if "text" in block and isinstance(block["text"], str):
                    parts.append(block["text"])
                elif isinstance(block.get("content"), str):
                    parts.append(block["content"])
            elif isinstance(block, str):
                parts.append(block)
        if parts:
            return "\n".join(parts)

    return str(content)


def _log_llm(
    state: "ChatState | None",
    node_name: str,
    messages: list,
    response_text: str | None,
    latency_ms: int,
    error: str | None = None,
) -> None:
    logger.debug(
        "[%s] llm call: %d msgs, %s chars",
        node_name,
        len(messages),
        len(response_text or ""),
    )
    state = state or {}
    chat_id = state.get("chat_id")
    logger.info("[trace] node=%s chat_id=%s has_state=%s", node_name, chat_id, bool(state))
    if not chat_id:
        return
    prompt_system = next(
        (m.content for m in messages if m.__class__.__name__ == "SystemMessage"), None
    )
    prompt_user = next(
        (m.content for m in messages if m.__class__.__name__ == "HumanMessage"), None
    )
    model = state.get("model") or settings.AI_MODEL
    from agent_service.supabase_client import insert_trace  # local import avoids circular
    insert_trace(
        chat_id=chat_id,
        node_name=node_name,
        model=model,
        prompt_system=prompt_system if isinstance(prompt_system, str) else str(prompt_system) if prompt_system else None,
        prompt_user=prompt_user if isinstance(prompt_user, str) else str(prompt_user) if prompt_user else None,
        response=response_text,
        latency_ms=latency_ms,
        error=error,
    )


def _binance_trade_url(symbol: str) -> str:
    base = symbol.replace("USDT", "")
    return f"https://www.binance.com/en/trade/{base}_USDT"


def _inject_binance_link(text: str, symbol: str) -> str:
    base = symbol.replace("USDT", "")
    url = _binance_trade_url(symbol)
    bold = f"**{base}**"
    if bold in text:
        return text.replace(bold, f"**[{base}]({url})**", 1)
    if base in text:
        return text.replace(base, f"[{base}]({url})", 1)
    return f"{text}\n\n[Operar {base} en Binance]({url})"
