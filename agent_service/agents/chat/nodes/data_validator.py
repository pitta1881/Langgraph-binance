from __future__ import annotations

from ...shared.state import ChatState


async def data_validator(state: ChatState) -> ChatState:
    price_context = state.get("price_context", "")
    intent = state.get("intent", "analysis")
    valid = bool(price_context and "unavailable" not in price_context.lower())
    if intent == "price_only":
        return {"data_valid": True}
    return {"data_valid": valid}


def route_after_validation(state: ChatState) -> str:
    if state.get("data_valid"):
        intent = state.get("intent", "analysis")
        if intent == "price_only":
            return "price_only"
        return "chart_analyst"
    return "price_only"
