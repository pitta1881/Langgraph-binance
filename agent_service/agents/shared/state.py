from __future__ import annotations

from typing import Literal, TypedDict


class ChatState(TypedDict, total=False):
    user_message: str
    intent: Literal["price_only", "analysis", "market_overview", "coin_info", "no_symbol"]
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
