from __future__ import annotations

import logging
import time

from langchain_core.messages import HumanMessage, SystemMessage

from ...shared.state import ChatState
from ._helpers import _extract_text, _inject_binance_link, _llm, _log_llm

logger = logging.getLogger(__name__)


_EMPTY_MARKERS = ("no disponible", "no disponibles", "sin datos", "unavailable")


def _looks_empty(text: str) -> bool:
    if not text or not text.strip():
        return True
    lowered = text.lower()
    return any(marker in lowered for marker in _EMPTY_MARKERS)


async def reviewer(state: ChatState) -> ChatState:
    symbol = state.get("symbol", "BTCUSDT")
    user_message = state.get("user_message", "")
    price_context = state.get("price_context", "")
    chart = state.get("chart_analysis", "")
    finance = state.get("finance_analysis", "")
    crypto = state.get("crypto_analysis", "")

    # Defense in depth: if data_validator let this through but every upstream
    # analysis is empty / says "no disponible", do NOT compose a 250-word
    # synthesis about emptiness. Short-circuit with an honest one-liner.
    if _looks_empty(chart) and _looks_empty(finance) and _looks_empty(crypto):
        base = symbol.replace("USDT", "")
        final = (
            f"Mirá, no encontré datos en vivo de **{base}** en Binance para armar el análisis. "
            "¿Querés que te explique qué es la moneda, o probamos con otro ticker?"
        )
        return {"response": _inject_binance_link(final, symbol)}

    system = SystemMessage(
        content=(
            "Sos un analista cripto senior que sintetiza varios análisis en un reporte final. "
            "REGLA CRÍTICA: usá SOLO los análisis y datos provistos abajo. "
            "NO agregues información de tu conocimiento previo. "
            "Respondé siempre en español rioplatense.\n\n"
            "FORMATO DE SALIDA (exactamente esta estructura):\n\n"
            "1) Arrancá con 1-2 oraciones conversacionales que respondan DIRECTAMENTE a la pregunta del usuario, "
            "retomando el símbolo y la intención. Ejemplos:\n"
            "   - Pregunta '¿la tendencia de BTC es bearish?' → 'Sí, BTC viene mostrando una tendencia bajista "
            "en el corto plazo: cae X% en 24h y...'\n"
            "   - Pregunta 'hacé un análisis de ETH' → 'Mirá, ETH está en una zona interesante: cotiza a Y "
            "después de subir Z% en la semana...'\n"
            "   NO uses saludos ('Hola', 'Buenas'). Las 1-2 oraciones tienen que sentirse parte de una charla.\n\n"
            "2) Después de la intro, EXACTAMENTE este bloque markdown:\n\n"
            "## Recomendación\n"
            "- 📈 **Short term:** BUY | SELL | HOLD\n"
            "- 📊 **Medium term:** BUY | SELL | HOLD\n"
            "- 🔭 **Long term:** BUY | SELL | HOLD\n\n"
            "## Análisis\n"
            "<6-8 oraciones sintetizando los tres análisis, 150-250 palabras>\n\n"
            "_Esto no es asesoramiento financiero._\n\n"
            "Reglas:\n"
            "- Elegí EXACTAMENTE UNO de BUY, SELL, HOLD por horizonte.\n"
            "- NO envuelvas la respuesta en code fences.\n"
            "- La intro va ANTES de '## Recomendación', y son 1-2 oraciones, no más."
        )
    )
    user = HumanMessage(
        content=(
            f"Pregunta del usuario: \"{user_message}\"\n\n"
            f"Símbolo: {symbol}\n{price_context}\n\n"
            f"Análisis técnico:\n{chart}\n\n"
            f"Análisis financiero:\n{finance}\n\n"
            f"Análisis del ecosistema cripto:\n{crypto}\n\n"
            "Sintetizá en el reporte final siguiendo el formato del system message."
        )
    )

    t0 = time.perf_counter()
    try:
        llm = _llm(state)
        response = await llm.ainvoke([system, user])
        final = _extract_text(response)
        latency_ms = int((time.perf_counter() - t0) * 1000)
        _log_llm(state, "reviewer", [system, user], final, latency_ms)
    except Exception as exc:
        latency_ms = int((time.perf_counter() - t0) * 1000)
        _log_llm(state, "reviewer", [system, user], None, latency_ms, error=str(exc))
        logger.warning("reviewer failed: %s", exc)
        final = (
            f"Análisis de {symbol}:\n\n"
            f"{chart}\n\n{finance}\n\n{crypto}\n\n"
            "Esto no es asesoramiento financiero."
        )

    final = _inject_binance_link(final, symbol)
    return {"response": final}
