from __future__ import annotations

import logging
from typing import Any

from langchain_google_genai import ChatGoogleGenerativeAI

from ....settings import settings

logger = logging.getLogger(__name__)


def _llm(temperature: float = 0.3) -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=settings.AI_MODEL,
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


def _log_llm(node: str, messages: list, response: str) -> None:
    logger.debug(
        "[%s] LLM call — messages=%d, response_len=%d",
        node,
        len(messages),
        len(response),
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
