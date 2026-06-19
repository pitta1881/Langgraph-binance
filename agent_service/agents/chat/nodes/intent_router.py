from __future__ import annotations

import json
import logging
import re
import time

from langchain_core.messages import HumanMessage, SystemMessage

from ...shared.state import ChatState
from ._helpers import _extract_text, _llm, _log_llm
from ._symbols import _format_history_for_router, _last_symbol_from_history, _resolve_symbol

logger = logging.getLogger(__name__)


async def intent_router(state: ChatState) -> ChatState:
    user_message = state.get("user_message", "")
    history = state.get("history") or []
    symbol = _resolve_symbol(user_message)
    history_block = _format_history_for_router(history)

    system_parts = [
        "Clasificás mensajes del usuario en intents para un asistente cripto. "
        "Respondé SOLO con un objeto JSON: {\"intent\": \"...\", \"symbol\": \"...\"}.\n\n"
        "Intents:\n"
        "- price_only: el usuario pregunta el precio de una moneda\n"
        "- analysis: el usuario pide análisis, predicción o recomendación de compra/venta\n"
        "- market_overview: el usuario pregunta sobre el mercado en general, trending, top movers\n"
        "- coin_info: el usuario pregunta QUÉ ES una moneda, sus fundamentos, qué hace\n"
        "- recommendation: el usuario pide ideas de inversión / qué comprar / cómo distribuir plata "
        "SIN nombrar una moneda específica (ej: 'en qué invierto 1000 USD?', 'recomendame una cripto', "
        "'qué conviene comprar hoy?', 'cuál me recomendás?'). Si nombra una moneda específica, usá 'analysis'.\n"
        "- no_symbol: la pregunta es sobre crypto pero no se puede inferir una moneda específica Y no es un pedido de recomendación\n"
        "- off_topic: la pregunta NO es sobre crypto en absoluto "
        "(clima, política, recetas, ayuda con código, deportes, saludos, cualquier cosa fuera del mercado cripto)\n\n"
        "Formato del símbolo: XXXUSDT (ej. BTCUSDT). Usá null cuando no aplique.\n\n"
        "Reglas de carryover (esto es crítico):\n"
        "- Si el mensaje actual tiene una referencia EXPLÍCITA a una cripto (nombre o símbolo), usá esa. "
        "Lo explícito siempre le gana al contexto.\n"
        "- Si el mensaje actual es una pregunta de crypto con referencia IMPLÍCITA "
        "(pronombres, elisión, ej: 'comprar?', 'subió?', 'y la semana?', 'es buen momento?'), "
        "arrastrá el símbolo del turno asistente más reciente del contexto.\n"
        "- Si el mensaje actual NO es sobre crypto, devolvé intent='off_topic' y symbol=null. "
        "NUNCA arrastres un símbolo en preguntas off-topic, aunque los turnos anteriores hayan sido sobre crypto.\n\n"
        "Ejemplos:\n"
        "- 'Cómo está el clima en Miami?' (después de un análisis de TRX) -> "
        "{\"intent\": \"off_topic\", \"symbol\": null}\n"
        "- 'Debería vender?' (después de un análisis de TRX) -> "
        "{\"intent\": \"analysis\", \"symbol\": \"TRXUSDT\"}\n"
        "- 'Qué es Solana?' -> {\"intent\": \"coin_info\", \"symbol\": \"SOLUSDT\"}\n"
        "- 'hola' -> {\"intent\": \"off_topic\", \"symbol\": null}\n"
        "- 'precio btc' -> {\"intent\": \"price_only\", \"symbol\": \"BTCUSDT\"}\n"
        "- 'cómo está el mercado?' -> {\"intent\": \"market_overview\", \"symbol\": null}\n"
        "- 'en qué invierto 1000 dólares?' -> {\"intent\": \"recommendation\", \"symbol\": null}\n"
        "- 'recomendame una cripto' -> {\"intent\": \"recommendation\", \"symbol\": null}\n"
        "- 'qué conviene comprar hoy?' -> {\"intent\": \"recommendation\", \"symbol\": null}\n"
        "- 'debería comprar BTC?' -> {\"intent\": \"analysis\", \"symbol\": \"BTCUSDT\"}\n\n"
        "Respondé SOLO con el JSON. Sin prosa, sin code fences."
    ]
    if history_block:
        system_parts.append("\n\nContexto de la conversación (del más antiguo al más reciente):\n" + history_block)
    system = SystemMessage(content="".join(system_parts))
    user = HumanMessage(content=user_message)

    t0 = time.perf_counter()
    try:
        llm = _llm(state, temperature=0)
        response = await llm.ainvoke([system, user])
        text = _extract_text(response)
        latency_ms = int((time.perf_counter() - t0) * 1000)
        _log_llm(state, "intent_router", [system, user], text, latency_ms)

        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"```\w*\n?", "", cleaned).replace("```", "").strip()

        parsed = json.loads(cleaned)
        intent = parsed.get("intent", "no_symbol")
        llm_symbol = parsed.get("symbol")

        # The LLM gets the final word on symbol. We only fall back to the
        # local pattern match when the LLM didn't return one.
        if llm_symbol and not symbol:
            symbol = _resolve_symbol(llm_symbol) or llm_symbol

        # Defensive normalization: off_topic must never carry a symbol.
        if intent == "off_topic":
            symbol = None
        elif intent == "recommendation":
            # Recommendation is symbol-free by definition. If the LLM tagged a
            # symbol it likely meant 'analysis'; otherwise just drop it.
            if symbol:
                intent = "analysis"
        elif intent in ("price_only", "analysis", "coin_info") and not symbol:
            # LLM marked it as crypto but couldn't resolve a symbol — downgrade.
            intent = "no_symbol"

    except Exception as exc:
        # JSON parse failure or LLM error: graceful fallback.
        # If we have a local symbol or one in history, treat it as analysis;
        # otherwise off_topic so we don't burn LLM calls on garbage.
        latency_ms = int((time.perf_counter() - t0) * 1000)
        _log_llm(state, "intent_router", [system, user], None, latency_ms, error=str(exc))
        logger.warning("intent_router failed: %s", exc)
        if not symbol:
            symbol = _last_symbol_from_history(history)
        intent = "analysis" if symbol else "off_topic"

    logger.info("intent_router: intent=%s, symbol=%s", intent, symbol)
    return {"intent": intent, "symbol": symbol}


def route_after_intent(state: ChatState) -> str:
    intent = state.get("intent", "no_symbol")
    if intent == "off_topic":
        return "off_topic"
    if intent == "market_overview":
        return "market_scout"
    if intent == "recommendation":
        return "advisor"
    if intent == "no_symbol":
        return "no_symbol"
    if intent == "coin_info":
        return "coin_info"
    return "price_fetcher"
