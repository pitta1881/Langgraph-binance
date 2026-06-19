from __future__ import annotations

import logging
import time

from langchain_core.messages import HumanMessage, SystemMessage

from ...shared.state import ChatState
from ._helpers import _extract_text, _llm, _log_llm
from ._symbols import SYMBOLS

logger = logging.getLogger(__name__)

_POPULAR_COINS = ", ".join(s.replace("USDT", "") for s in SYMBOLS[:8])

_NO_SYMBOL_FALLBACK = (
    "No identifiqué ninguna criptomoneda en tu mensaje. "
    "¿Podés especificar cuál te interesa? "
    f"Algunas opciones: {_POPULAR_COINS}..."
)

_OFF_TOPIC_FALLBACK = (
    "Soy un asistente especializado en criptomonedas. "
    "No puedo ayudarte con esa consulta, pero preguntame sobre "
    "cualquier moneda — precio, análisis técnico, o qué es y cómo funciona."
)


async def no_symbol_response(state: ChatState) -> ChatState:
    user_message = state.get("user_message", "")

    system = SystemMessage(
        content=(
            "Sos un asistente cripto conversacional. El usuario preguntó algo sobre crypto "
            "pero no pudiste identificar una moneda específica. "
            "Respondé en español rioplatense, retomando lo que preguntó en 1 oración corta, "
            "y pedile que aclare qué cripto le interesa. "
            f"Ofrecé 4-5 opciones populares de esta lista: {_POPULAR_COINS}. "
            "Tono cálido, sin saludos. Máximo 2 oraciones en total."
        )
    )
    user = HumanMessage(content=f"Mensaje del usuario: \"{user_message}\"")

    msgs = [system, user]
    t0 = time.perf_counter()
    try:
        llm = _llm(state)
        response = await llm.ainvoke(msgs)
        final = _extract_text(response).strip()
        latency_ms = int((time.perf_counter() - t0) * 1000)
        _log_llm(state, "no_symbol", msgs, final, latency_ms)
        if not final:
            final = _NO_SYMBOL_FALLBACK
    except Exception as exc:
        latency_ms = int((time.perf_counter() - t0) * 1000)
        _log_llm(state, "no_symbol", msgs, None, latency_ms, error=str(exc))
        logger.warning("no_symbol LLM failed: %s", exc)
        final = _NO_SYMBOL_FALLBACK

    return {"response": final}


async def off_topic_response(state: ChatState) -> ChatState:
    user_message = state.get("user_message", "")

    system = SystemMessage(
        content=(
            "Sos un asistente especializado en criptomonedas. El usuario preguntó algo "
            "fuera de tu dominio. Respondé en español rioplatense, cálido y breve: "
            "mencioná amablemente que no podés ayudar con ESE tema específico "
            "(retomá brevemente lo que preguntó para que se sienta escuchado, sin sonar genérico), "
            "y redirigí a temas crypto que sí podés cubrir "
            "(precio de una moneda, análisis técnico, qué es una cripto, recomendaciones de inversión). "
            "Máximo 2 oraciones. Sin saludos."
        )
    )
    user = HumanMessage(content=f"Mensaje del usuario: \"{user_message}\"")

    msgs = [system, user]
    t0 = time.perf_counter()
    try:
        llm = _llm(state)
        response = await llm.ainvoke(msgs)
        final = _extract_text(response).strip()
        latency_ms = int((time.perf_counter() - t0) * 1000)
        _log_llm(state, "off_topic", msgs, final, latency_ms)
        if not final:
            final = _OFF_TOPIC_FALLBACK
    except Exception as exc:
        latency_ms = int((time.perf_counter() - t0) * 1000)
        _log_llm(state, "off_topic", msgs, None, latency_ms, error=str(exc))
        logger.warning("off_topic LLM failed: %s", exc)
        final = _OFF_TOPIC_FALLBACK

    return {"response": final}
