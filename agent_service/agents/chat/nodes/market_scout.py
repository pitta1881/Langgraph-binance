from __future__ import annotations

import logging
import time

from langchain_core.messages import HumanMessage, SystemMessage

from ....binance import create_binance_client
from ...shared.state import ChatState
from ._helpers import _extract_text, _inject_binance_link, _llm, _log_llm

logger = logging.getLogger(__name__)


async def market_scout(state: ChatState) -> ChatState:
    client = create_binance_client()
    try:
        tickers = await client.get_all_tickers()
        usdt_pairs = [t for t in tickers if t.symbol.endswith("USDT")]
        top_gainers = sorted(usdt_pairs, key=lambda t: t.change_pct, reverse=True)[:5]
        top_losers = sorted(usdt_pairs, key=lambda t: t.change_pct)[:5]

        market_data = "📈 TOP GAINERS (24h):\n"
        for t in top_gainers:
            market_data += f"  {t.symbol}: ${t.price:,.4f} ({t.change_pct:+.2f}%)\n"
        market_data += "\n📉 TOP LOSERS (24h):\n"
        for t in top_losers:
            market_data += f"  {t.symbol}: ${t.price:,.4f} ({t.change_pct:+.2f}%)\n"
    except Exception as exc:
        logger.warning("market_scout data fetch failed: %s", exc)
        market_data = "Market data unavailable."

    system = SystemMessage(
        content=(
            "You are a crypto market analyst. Summarize the market overview based on the data. "
            "CRITICAL RULE: you may ONLY use the market data provided below. "
            "Do NOT invent prices or percentages. "
            "Always respond in Spanish. No greetings or filler. "
            "Write 4-6 sentences. End with a brief disclaimer: 'Esto no es asesoramiento financiero.'"
        )
    )
    user = HumanMessage(
        content=f"User: {state.get('user_message', '')}\n\nMarket data:\n{market_data}"
    )

    t0 = time.perf_counter()
    try:
        llm = _llm(state)
        response = await llm.ainvoke([system, user])
        final = _extract_text(response)
        latency_ms = int((time.perf_counter() - t0) * 1000)
        _log_llm(state, "market_scout", [system, user], final, latency_ms)
    except Exception as exc:
        latency_ms = int((time.perf_counter() - t0) * 1000)
        _log_llm(state, "market_scout", [system, user], None, latency_ms, error=str(exc))
        logger.warning("market_scout LLM failed: %s", exc)
        final = market_data

    for t in top_gainers[:5]:
        final = _inject_binance_link(final, t.symbol)

    return {"response": final}
