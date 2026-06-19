from __future__ import annotations

import logging
import time

from langchain_core.messages import HumanMessage, SystemMessage

from ...shared.state import ChatState
from ._helpers import (
    _binance_trade_url,
    _extract_text,
    _inject_binance_link,
    _llm,
    _log_llm,
)

logger = logging.getLogger(__name__)


async def price_only(state: ChatState) -> ChatState:
    symbol = state.get("symbol", "BTCUSDT")
    price_context = state.get("price_context", "Sin datos")
    user_message = state.get("user_message", "")
    base = symbol.replace("USDT", "")

    system = SystemMessage(
        content=(
            "Sos un asistente cripto conversacional. Respondé en español rioplatense "
            "retomando la pregunta del usuario.\n\n"
            "REGLA CRÍTICA: usá SOLO los datos provistos abajo. NO inventes precios ni variaciones.\n\n"
            "DOS ESCENARIOS:\n"
            "1) Si los datos incluyen precio real (líneas con 'Precio:', 'Cambio 24h:', etc.): "
            "respondé en 2-3 oraciones mencionando el precio actual, la variación 24h y "
            "una observación breve del momentum (subiendo/bajando/lateral). "
            "Ej: 'El precio de BTC ahora es $X, viene subiendo Y% en 24h...'.\n"
            "2) Si los datos dicen 'Datos de precio no disponibles' o similar: "
            "respondé en UNA SOLA oración honesta diciendo que no encontraste datos en vivo "
            "para esa moneda en Binance y ofrecé alternativas concretas "
            "(ej: 'Mirá, no estoy encontrando datos en vivo de X en Binance. "
            "Puedo contarte qué es la moneda o probar con otro ticker si querés.'). "
            "Nada más. No inventes nada.\n\n"
            "Nunca agregues recomendaciones BUY/SELL/HOLD ni análisis técnico. No uses saludos."
        )
    )
    user = HumanMessage(
        content=(
            f"Pregunta del usuario: \"{user_message}\"\n"
            f"Símbolo: {symbol}\n"
            f"Datos:\n{price_context}"
        )
    )

    msgs = [system, user]
    t0 = time.perf_counter()
    try:
        llm = _llm(state)
        response = await llm.ainvoke(msgs)
        final = _extract_text(response)
        latency_ms = int((time.perf_counter() - t0) * 1000)
        _log_llm(state, "price_only", msgs, final, latency_ms)
    except Exception as exc:
        latency_ms = int((time.perf_counter() - t0) * 1000)
        _log_llm(state, "price_only", msgs, None, latency_ms, error=str(exc))
        logger.warning("price_only LLM failed: %s", exc)
        link = f"[Operar en Binance]({_binance_trade_url(symbol)})"
        final = f"📊 **{symbol}**\n\n{price_context}\n\n{link}"
        return {"response": final}

    final = _inject_binance_link(final, symbol)
    return {"response": final}
