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
        "You classify user messages into intents for a crypto assistant. "
        "Respond with ONLY a JSON object: {\"intent\": \"...\", \"symbol\": \"...\"}.\n\n"
        "Intents:\n"
        "- price_only: user asks for a coin's price\n"
        "- analysis: user asks for analysis, prediction, or a buy/sell recommendation\n"
        "- market_overview: user asks about the general market, trending, top movers\n"
        "- coin_info: user asks what a coin IS, its fundamentals, what it does\n"
        "- no_symbol: the question is about crypto but no specific coin can be inferred\n"
        "- off_topic: the question is NOT about crypto at all "
        "(weather, politics, recipes, code help, sports, greetings, anything outside crypto markets)\n\n"
        "Symbol format: XXXUSDT (e.g. BTCUSDT). Use null when not applicable.\n\n"
        "Carryover rules (this is critical):\n"
        "- If the current message has an EXPLICIT crypto reference (a coin name or symbol), use that. "
        "Explicit always wins over context.\n"
        "- If the current message is a crypto question with an IMPLICIT reference "
        "(pronouns, elision, e.g. 'comprar?', 'subió?', 'y la semana?', 'es buen momento?'), "
        "carry over the symbol from the most recent assistant turn in the context.\n"
        "- If the current message is NOT about crypto, return intent='off_topic' and symbol=null. "
        "NEVER carry over a symbol for off-topic questions, even if the previous turns were about crypto.\n\n"
        "Examples:\n"
        "- 'Cómo está el clima en Miami?' (after TRX analysis) -> "
        "{\"intent\": \"off_topic\", \"symbol\": null}\n"
        "- 'Debería vender?' (after TRX analysis) -> "
        "{\"intent\": \"analysis\", \"symbol\": \"TRXUSDT\"}\n"
        "- 'Qué es Solana?' -> {\"intent\": \"coin_info\", \"symbol\": \"SOLUSDT\"}\n"
        "- 'hola' -> {\"intent\": \"off_topic\", \"symbol\": null}\n"
        "- 'precio btc' -> {\"intent\": \"price_only\", \"symbol\": \"BTCUSDT\"}\n"
        "- 'cómo está el mercado?' -> {\"intent\": \"market_overview\", \"symbol\": null}\n\n"
        "Respond with ONLY the JSON. No prose, no code fences."
    ]
    if history_block:
        system_parts.append("\n\nConversation context (oldest first):\n" + history_block)
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
    if intent == "no_symbol":
        return "no_symbol"
    if intent == "coin_info":
        return "coin_info"
    return "price_fetcher"
