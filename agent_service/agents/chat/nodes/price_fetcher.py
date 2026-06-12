from __future__ import annotations

import logging

from ....binance import create_binance_client
from ...shared.state import ChatState

logger = logging.getLogger(__name__)


async def price_fetcher(state: ChatState) -> ChatState:
    symbol = state.get("symbol", "BTCUSDT")
    client = create_binance_client()

    try:
        ticker = await client.get_ticker(symbol)
        price_context = (
            f"Symbol: {symbol}\n"
            f"Price: ${ticker.price:,.2f}\n"
            f"24h Change: {ticker.change_pct:+.2f}%\n"
            f"24h High: ${ticker.high:,.2f}\n"
            f"24h Low: ${ticker.low:,.2f}\n"
            f"24h Volume: {ticker.volume:,.0f}"
        )
    except Exception as exc:
        logger.warning("price_fetcher failed for %s: %s", symbol, exc)
        price_context = f"Symbol: {symbol}\nPrice data unavailable."

    try:
        klines_7d = await client.get_klines(symbol, interval="4h", limit=42)
        klines_7d_data = [
            {
                "open_time": k["open_time"],
                "open": k["open"],
                "high": k["high"],
                "low": k["low"],
                "close": k["close"],
                "volume": k["volume"],
            }
            for k in klines_7d
        ]
    except Exception as exc:
        logger.warning("klines fetch failed for %s: %s", symbol, exc)
        klines_7d_data = []

    return {
        "price_context": price_context,
        "klines_7d": klines_7d_data,
    }
