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
            "Sos un analista financiero especializado en mercados cripto. "
            "REGLA CRÍTICA: basá tu análisis SOLO en los datos provistos. "
            "NO uses conocimiento previo. "
            "Enfocate en riesgo/beneficio, evaluación de volatilidad y posicionamiento de mercado. "
            "Respondé en español rioplatense. Sin saludos. "
            "Escribí 4-5 oraciones."
        )
    )
    user = HumanMessage(
        content=(
            f"Símbolo: {symbol}\n{price_context}\n\n"
            f"Análisis técnico:\n{chart}\n\n"
            "Hacé un análisis financiero estrictamente en base a estos datos."
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
        analysis = f"Análisis financiero no disponible para {symbol}."

    return {"finance_analysis": analysis}
