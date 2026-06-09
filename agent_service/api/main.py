"""Crypto Agent microservice.

Exposes the LangGraph multi-agent pipeline via a single HTTP endpoint. Market
data endpoints (Binance, CoinGecko) live in the Fastify gateway — this service
only owns the LLM orchestration.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel

from ..agents.chat import build_chat_graph
from ..settings import settings


logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
# Silence noisy libraries; keep our app loggers at the configured level.
for name in ("httpx", "httpcore", "google.auth", "google.api_core",
             "langchain", "langsmith", "watchfiles"):
    logging.getLogger(name).setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

app = FastAPI(title="Crypto Agent Service")
graph = build_chat_graph()


def _regenerate_graph_png() -> None:
    """Refresh `artifacts/graph.png` from the compiled LangGraph at startup.

    Uses LangGraph's `draw_mermaid_png` which calls out to mermaid.ink. If
    that fails (no network, throttled endpoint), we log and continue —
    refreshing the diagram must never block the service from starting.
    """
    try:
        out = Path(__file__).resolve().parents[2] / "artifacts" / "graph.png"
        out.parent.mkdir(parents=True, exist_ok=True)
        png = graph.get_graph().draw_mermaid_png()
        out.write_bytes(png)
        logger.info("Graph artifact updated: %s (%d bytes)", out, len(png))
    except Exception as exc:
        logger.warning("Could not regenerate graph.png: %s", exc)


_regenerate_graph_png()
logger.info("Crypto Agent Service started — graph compiled")


class RunAgentRequest(BaseModel):
    message: str
    history: list[dict[str, Any]] | None = None


@app.post("/run-agent")
async def run_agent(req: RunAgentRequest) -> dict:
    history = req.history or []
    logger.debug("run_agent received: msg=%r, history_turns=%d",
                 req.message, len(history))
    state = await graph.ainvoke({
        "user_message": req.message,
        "history": history,
    })
    logger.debug("run_agent finished — intent=%s symbol=%s",
                 state.get("intent"), state.get("symbol"))
    return dict(state)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
