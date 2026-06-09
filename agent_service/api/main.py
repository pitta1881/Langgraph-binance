"""Crypto Agent microservice.

Exposes the LangGraph multi-agent pipeline via a single HTTP endpoint. Market
data endpoints (Binance, CoinGecko) live in the Fastify gateway — this service
only owns the LLM orchestration.
"""
from __future__ import annotations

import logging

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
logger.info("Crypto Agent Service started — graph compiled")


class RunAgentRequest(BaseModel):
    message: str


@app.post("/run-agent")
async def run_agent(req: RunAgentRequest) -> dict:
    logger.debug("run_agent received: %r", req.message)
    state = await graph.ainvoke({"user_message": req.message})
    logger.debug("run_agent finished — state keys: %s", list(state.keys()))
    return dict(state)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
