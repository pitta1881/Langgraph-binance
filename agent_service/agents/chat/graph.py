from __future__ import annotations

from langgraph.graph import END, StateGraph

from ..shared.state import ChatState
from .nodes import (
    advisor,
    chart_analyst,
    coin_info_responder,
    crypto_expert,
    data_validator,
    finance_expert,
    intent_router,
    market_scout,
    no_symbol_response,
    off_topic_response,
    price_fetcher,
    price_only,
    reviewer,
    route_after_intent,
    route_after_validation,
)


def build_chat_graph() -> StateGraph:
    builder = StateGraph(ChatState)

    builder.add_node("intent_router", intent_router)
    builder.add_node("price_fetcher", price_fetcher)
    builder.add_node("data_validator", data_validator)
    builder.add_node("chart_analyst", chart_analyst)
    builder.add_node("finance_expert", finance_expert)
    builder.add_node("crypto_expert", crypto_expert)
    builder.add_node("reviewer", reviewer)
    builder.add_node("price_only", price_only)
    builder.add_node("market_scout", market_scout)
    builder.add_node("advisor", advisor)
    builder.add_node("no_symbol", no_symbol_response)
    builder.add_node("off_topic", off_topic_response)
    builder.add_node("coin_info", coin_info_responder)

    builder.set_entry_point("intent_router")

    builder.add_conditional_edges(
        "intent_router",
        route_after_intent,
        {
            "price_fetcher": "price_fetcher",
            "market_scout": "market_scout",
            "advisor": "advisor",
            "no_symbol": "no_symbol",
            "off_topic": "off_topic",
            "coin_info": "coin_info",
        },
    )

    builder.add_conditional_edges(
        "data_validator",
        route_after_validation,
        {
            "chart_analyst": "chart_analyst",
            "price_only": "price_only",
        },
    )

    builder.add_edge("price_fetcher", "data_validator")
    builder.add_edge("chart_analyst", "finance_expert")
    builder.add_edge("finance_expert", "crypto_expert")
    builder.add_edge("crypto_expert", "reviewer")
    builder.add_edge("reviewer", END)
    builder.add_edge("price_only", END)
    builder.add_edge("market_scout", END)
    builder.add_edge("advisor", END)
    builder.add_edge("no_symbol", END)
    builder.add_edge("off_topic", END)
    builder.add_edge("coin_info", END)

    return builder.compile()
