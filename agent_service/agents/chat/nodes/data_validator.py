from __future__ import annotations

from ...shared.state import ChatState

# Phrases that indicate the upstream fetch failed. Keep both English and
# Spanish until every node finishes the translation pass — the English
# strings were the historical wording and may still appear in older states.
_MISSING_DATA_MARKERS = (
    "no disponible",
    "no disponibles",
    "sin datos",
    "unavailable",
)


def _has_real_price(price_context: str) -> bool:
    if not price_context:
        return False
    lowered = price_context.lower()
    return not any(marker in lowered for marker in _MISSING_DATA_MARKERS)


async def data_validator(state: ChatState) -> ChatState:
    price_context = state.get("price_context", "")
    klines = state.get("klines_7d") or []
    intent = state.get("intent", "analysis")

    if intent == "price_only":
        # price_only only needs the price line. Even a partial price_context
        # is enough — the LLM will say what's missing.
        return {"data_valid": True}

    # Full analysis pipeline needs BOTH a real ticker fetch AND candles.
    # Without candles the chart_analyst has nothing to say and the reviewer
    # ends up synthesizing 200 words about a void.
    valid = _has_real_price(price_context) and bool(klines)
    return {"data_valid": valid}


def route_after_validation(state: ChatState) -> str:
    if state.get("data_valid"):
        intent = state.get("intent", "analysis")
        if intent == "price_only":
            return "price_only"
        return "chart_analyst"
    return "price_only"
