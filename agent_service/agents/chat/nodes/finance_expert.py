from __future__ import annotations

import logging
import time

from langchain_core.messages import HumanMessage, SystemMessage

from ...shared.state import ChatState
from ._helpers import _extract_text, _llm, _log_llm

logger = logging.getLogger(__name__)


async def finance_expert(state: ChatState) -> ChatState:
    symbol = state.get("symbol", "BTCUSDT")
    price_context = state.get("price_context", "")
    chart = state.get("chart_analysis", "")

    system = SystemMessage(
        content=(
            "You are a financial analyst specializing in crypto markets. "
            "CRITICAL RULE: base your analysis ONLY on the data provided. "
            "Do NOT use prior knowledge. "
            "Focus on risk/reward, volatility assessment, and market positioning. "
            "Always respond in Spanish. No greetings or filler. "
            "Write 4-5 sentences."
        )
    )
    user = HumanMessage(
        content=(
            f"Symbol: {symbol}\n{price_context}\n\n"
            f"Technical analysis:\n{chart}\n\n"
            "Provide financial analysis based strictly on this data."
        )
    )

    t0 = time.perf_counter()
    try:
        llm = _llm(state)
        response = await llm.ainvoke([system, user])
        analysis = _extract_text(response)
        latency_ms = int((time.perf_counter() - t0) * 1000)
        _log_llm(state, "finance_expert", [system, user], analysis, latency_ms)
    except Exception as exc:
        latency_ms = int((time.perf_counter() - t0) * 1000)
        _log_llm(state, "finance_expert", [system, user], None, latency_ms, error=str(exc))
        logger.warning("finance_expert failed: %s", exc)
        analysis = f"Financial analysis unavailable for {symbol}."

    return {"finance_analysis": analysis}
