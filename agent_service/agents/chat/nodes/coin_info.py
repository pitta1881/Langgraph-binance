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
            "You are a crypto educator that explains what a cryptocurrency is in simple terms. "
            "CRITICAL RULE: you may ONLY respond based on the coin data provided in this message. "
            "Do NOT use prior knowledge about this coin or any other coin. "
            "If the data is insufficient, say so explicitly. "
            "Always respond in Spanish. No greetings or filler — go straight to the explanation. "
            "Format: a concise explanation (under 150 words) covering what the coin is, "
            "its purpose, and key technical characteristics. Use the provided data only."
        )
    )
    user = HumanMessage(
        content=(
            f"User question: \"{user_message}\"\n\n"
            f"Coin data (from CoinGecko):\n{info}\n\n"
            "Explain this coin to the user based strictly on the data above."
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
