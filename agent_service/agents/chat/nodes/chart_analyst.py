from __future__ import annotations

import logging
import time

from langchain_core.messages import HumanMessage, SystemMessage

from ...shared.state import ChatState
from ._helpers import _extract_text, _llm, _log_llm

logger = logging.getLogger(__name__)


async def chart_analyst(state: ChatState) -> ChatState:
    symbol = state.get("symbol", "BTCUSDT")
    klines = state.get("klines_7d", [])
    price_context = state.get("price_context", "")

    klines_summary = ""
    if klines:
        closes = [k["close"] for k in klines]
        highs = [k["high"] for k in klines]
        lows = [k["low"] for k in klines]
        klines_summary = (
            f"7d OHLC ({len(klines)} candles, 4h):\n"
            f"  Range: ${min(lows):,.2f} - ${max(highs):,.2f}\n"
            f"  Open: ${closes[0]:,.2f} → Close: ${closes[-1]:,.2f}\n"
            f"  Trend: {'UP' if closes[-1] > closes[0] else 'DOWN'} "
            f"({((closes[-1] - closes[0]) / closes[0] * 100):+.2f}%)"
        )

    system = SystemMessage(
        content=(
            "You are a technical chart analyst for crypto. "
            "CRITICAL RULE: base your analysis ONLY on the price and kline data provided. "
            "Do NOT use prior knowledge about this coin. "
            "Identify support/resistance levels, trend direction, and key patterns. "
            "Always respond in Spanish. No greetings or filler. "
            "Write 5-6 sentences."
        )
    )
    user = HumanMessage(
        content=(
            f"Symbol: {symbol}\n{price_context}\n\n{klines_summary}\n\n"
            "Provide technical analysis based strictly on this data."
        )
    )

    t0 = time.perf_counter()
    try:
        llm = _llm(state)
        response = await llm.ainvoke([system, user])
        analysis = _extract_text(response)
        latency_ms = int((time.perf_counter() - t0) * 1000)
        _log_llm(state, "chart_analyst", [system, user], analysis, latency_ms)
    except Exception as exc:
        latency_ms = int((time.perf_counter() - t0) * 1000)
        _log_llm(state, "chart_analyst", [system, user], None, latency_ms, error=str(exc))
        logger.error("chart_analyst failed: %s", exc, exc_info=True)
        analysis = f"Technical analysis unavailable for {symbol}."

    return {"chart_analysis": analysis}
