from __future__ import annotations

from ...shared.state import ChatState
from ._helpers import _binance_trade_url


async def price_only(state: ChatState) -> ChatState:
    symbol = state.get("symbol", "BTCUSDT")
    price_context = state.get("price_context", "No data")
    link = f"[Operar en Binance]({_binance_trade_url(symbol)})"
    response = f"📊 **{symbol}**\n\n{price_context}\n\n{link}"
    return {"response": response}
