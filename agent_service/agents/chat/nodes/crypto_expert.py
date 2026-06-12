from __future__ import annotations

import logging

from langchain_core.messages import HumanMessage, SystemMessage

from ...shared.state import ChatState
from ._helpers import _extract_text, _llm, _log_llm

logger = logging.getLogger(__name__)


async def crypto_expert(state: ChatState) -> ChatState:
    symbol = state.get("symbol", "BTCUSDT")
    price_context = state.get("price_context", "")
    chart = state.get("chart_analysis", "")
    finance = state.get("finance_analysis", "")

    system = SystemMessage(
        content=(
            "You are a crypto ecosystem expert. "
            "CRITICAL RULE: base your analysis ONLY on the data provided. "
            "Do NOT use prior knowledge about this coin's fundamentals. "
            "Focus on on-chain signals, ecosystem context, and sentiment from the data. "
            "Always respond in Spanish. No greetings or filler. "
            "Write 4-5 sentences."
        )
    )
    user = HumanMessage(
        content=(
            f"Symbol: {symbol}\n{price_context}\n\n"
            f"Technical analysis:\n{chart}\n\n"
            f"Financial analysis:\n{finance}\n\n"
            "Provide crypto ecosystem analysis based strictly on this data."
        )
    )

    try:
        llm = _llm()
        response = await llm.ainvoke([system, user])
        analysis = _extract_text(response)
        _log_llm("crypto_expert", [system, user], analysis)
    except Exception as exc:
        logger.warning("crypto_expert failed: %s", exc)
        analysis = f"Crypto analysis unavailable for {symbol}."

    return {"crypto_analysis": analysis}
