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
            f"OHLC 7d ({len(klines)} velas, 4h):\n"
            f"  Rango: ${min(lows):,.2f} - ${max(highs):,.2f}\n"
            f"  Apertura: ${closes[0]:,.2f} → Cierre: ${closes[-1]:,.2f}\n"
            f"  Tendencia: {'ALCISTA' if closes[-1] > closes[0] else 'BAJISTA'} "
            f"({((closes[-1] - closes[0]) / closes[0] * 100):+.2f}%)"
        )

    system = SystemMessage(
        content=(
            "Sos un analista técnico de gráficos cripto. "
            "REGLA CRÍTICA: basá tu análisis SOLO en los datos de precio y klines provistos. "
            "NO uses conocimiento previo sobre esta moneda. "
            "Identificá niveles de soporte/resistencia, dirección de la tendencia y patrones clave. "
            "Respondé en español rioplatense. Sin saludos. "
            "Escribí 5-6 oraciones."
        )
    )
    user = HumanMessage(
        content=(
            f"Símbolo: {symbol}\n{price_context}\n\n{klines_summary}\n\n"
            "Hacé un análisis técnico estrictamente en base a estos datos."
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
        analysis = f"Análisis técnico no disponible para {symbol}."

    return {"chart_analysis": analysis}
