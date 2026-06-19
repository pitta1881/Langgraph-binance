from __future__ import annotations

import logging
import time

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
            "Sos un experto en el ecosistema cripto. "
            "REGLA CRÍTICA: basá tu análisis SOLO en los datos provistos. "
            "NO uses conocimiento previo sobre los fundamentos de esta moneda. "
            "Enfocate en señales on-chain, contexto del ecosistema y sentimiento que surjan de los datos. "
            "Respondé en español rioplatense. Sin saludos. "
            "Escribí 4-5 oraciones."
        )
    )
    user = HumanMessage(
        content=(
            f"Símbolo: {symbol}\n{price_context}\n\n"
            f"Análisis técnico:\n{chart}\n\n"
            f"Análisis financiero:\n{finance}\n\n"
            "Hacé un análisis del ecosistema cripto estrictamente en base a estos datos."
        )
    )

    t0 = time.perf_counter()
    try:
        llm = _llm(state)
        response = await llm.ainvoke([system, user])
        analysis = _extract_text(response)
        latency_ms = int((time.perf_counter() - t0) * 1000)
        _log_llm(state, "crypto_expert", [system, user], analysis, latency_ms)
    except Exception as exc:
        latency_ms = int((time.perf_counter() - t0) * 1000)
        _log_llm(state, "crypto_expert", [system, user], None, latency_ms, error=str(exc))
        logger.warning("crypto_expert failed: %s", exc)
        analysis = f"Análisis del ecosistema no disponible para {symbol}."

    return {"crypto_analysis": analysis}
