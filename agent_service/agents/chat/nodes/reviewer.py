from __future__ import annotations

import logging

from langchain_core.messages import HumanMessage, SystemMessage

from ...shared.state import ChatState
from ._helpers import _extract_text, _inject_binance_link, _llm, _log_llm

logger = logging.getLogger(__name__)


async def reviewer(state: ChatState) -> ChatState:
    symbol = state.get("symbol", "BTCUSDT")
    price_context = state.get("price_context", "")
    chart = state.get("chart_analysis", "")
    finance = state.get("finance_analysis", "")
    crypto = state.get("crypto_analysis", "")

    system = SystemMessage(
        content=(
            "You are a senior crypto analyst that synthesizes multiple analyses into a final report. "
            "CRITICAL RULE: you may ONLY use the analyses and data provided below. "
            "Do NOT add information from prior knowledge. "
            "Always respond in Spanish. No greetings or filler.\n\n"
            "OUTPUT FORMAT (follow EXACTLY, including the markdown):\n"
            "## Recomendación\n"
            "- 📈 **Short term:** BUY | SELL | HOLD\n"
            "- 📊 **Medium term:** BUY | SELL | HOLD\n"
            "- 🔭 **Long term:** BUY | SELL | HOLD\n\n"
            "## Análisis\n"
            "<6-8 sentences synthesizing the three analyses, 150-250 words>\n\n"
            "_Esto no es asesoramiento financiero._\n\n"
            "Rules:\n"
            "- Pick exactly ONE of BUY, SELL, HOLD for each horizon.\n"
            "- Do NOT wrap the response in code fences.\n"
            "- Do NOT add any text before '## Recomendación'."
        )
    )
    user = HumanMessage(
        content=(
            f"Symbol: {symbol}\n{price_context}\n\n"
            f"Technical analysis:\n{chart}\n\n"
            f"Financial analysis:\n{finance}\n\n"
            f"Crypto analysis:\n{crypto}\n\n"
            "Synthesize into a final report with recommendations."
        )
    )

    try:
        llm = _llm()
        response = await llm.ainvoke([system, user])
        final = _extract_text(response)
        _log_llm("reviewer", [system, user], final)
    except Exception as exc:
        logger.warning("reviewer failed: %s", exc)
        final = (
            f"Análisis de {symbol}:\n\n"
            f"{chart}\n\n{finance}\n\n{crypto}\n\n"
            "Esto no es asesoramiento financiero."
        )

    final = _inject_binance_link(final, symbol)
    return {"response": final}
