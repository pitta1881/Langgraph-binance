from __future__ import annotations

from typing import Literal, TypedDict


class ConversationTurn(TypedDict, total=False):
    """One compact entry in the rolling conversation history.

    Mirrors `shared/types/chat.ts` ConversationTurn. The frontend fills
    `content` only for user messages; for assistant messages it fills
    `symbol` + `intent` so the router can resolve implicit references
    ("comprar", "y de ETH?") without paying for the full reviewer text.
    """

    role: Literal["user", "assistant"]
    content: str
    symbol: str | None
    intent: str


class ChatState(TypedDict, total=False):
    user_message: str
    intent: Literal["price_only", "analysis", "market_overview", "coin_info", "recommendation", "no_symbol", "off_topic"]
    symbol: str | None
    coin_info: str
    price_context: str
    data_valid: bool
    klines_24h: list[dict]
    klines_7d: list[dict]
    chart_analysis: str
    finance_analysis: str
    crypto_analysis: str
    response: str
    history: list[ConversationTurn]
    model: str | None
    chat_id: str | None
