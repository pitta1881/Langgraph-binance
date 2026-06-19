from __future__ import annotations

import logging
import time

from langchain_core.messages import HumanMessage, SystemMessage

from ....coingecko import get_coin_info
from ...shared.state import ChatState
from ._helpers import _extract_text, _inject_binance_link, _llm, _log_llm

logger = logging.getLogger(__name__)


async def coin_info_responder(state: ChatState) -> ChatState:
    symbol = state.get("symbol", "BTCUSDT")
    user_message = state.get("user_message", "")

    if not symbol:
        return {
            "response": "No identifiqué ninguna criptomoneda en tu mensaje. ¿Podés especificar cuál te interesa?"
        }

    info = await get_coin_info(symbol)
    if not info:
        base = symbol.replace("USDT", "")
        return {
            "response": f"No tengo información fundamental sobre **{base}** en este momento."
        }

    system = SystemMessage(
        content=(
            "Sos un educador cripto que explica qué es una criptomoneda en términos simples. "
            "REGLA CRÍTICA: respondé SOLO en base a los datos provistos abajo. "
            "NO uses conocimiento previo sobre esta moneda ni ninguna otra. "
            "Si los datos son insuficientes, decilo explícitamente. "
            "Respondé en español rioplatense.\n\n"
            "Arrancá con una frase corta que retome lo que preguntó el usuario "
            "(ej: 'Mirá, Solana es...', 'Bitcoin es básicamente...'). No uses saludos. "
            "Después seguí con una explicación concisa (menos de 150 palabras en total) "
            "sobre qué es la moneda, para qué sirve y sus características técnicas clave. "
            "Usá SOLO los datos provistos."
        )
    )
    user = HumanMessage(
        content=(
            f"Pregunta del usuario: \"{user_message}\"\n\n"
            f"Datos de la moneda (CoinGecko):\n{info}\n\n"
            "Explicale al usuario esta moneda estrictamente en base a los datos de arriba."
        )
    )

    msgs = [system, user]
    t0 = time.perf_counter()
    try:
        llm = _llm(state)
        response = await llm.ainvoke(msgs)
        final = _extract_text(response)
        latency_ms = int((time.perf_counter() - t0) * 1000)
        _log_llm(state, "coin_info", msgs, final, latency_ms)
    except Exception as exc:
        latency_ms = int((time.perf_counter() - t0) * 1000)
        _log_llm(state, "coin_info", msgs, None, latency_ms, error=str(exc))
        logger.warning("coin_info_responder LLM failed: %s", exc)
        final = f"Información de {symbol.replace('USDT', '')}:\n\n{info}"

    final = _inject_binance_link(final, symbol)
    logger.info("coin_info_responder complete for %s", symbol)
    return {"response": final}
