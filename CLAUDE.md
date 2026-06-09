# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Full-stack crypto intelligence dashboard with an AI-powered chat assistant. Split into three services:

- **Frontend** (`frontend/`) — React 19 + Vite, port `:5173`
- **Gateway** (`backend-node/`) — Fastify + TypeScript, port `:8000`. Owns market data (Binance, CoinGecko) and proxies chat to the agent service.
- **Agent Service** (`agent_service/`) — FastAPI + LangGraph + Google Gemini, port `:8001`. Only owns the LLM pipeline.

## Commands

**Start everything** (three separate windows on Windows):
```
start.bat
```

**Run services individually:**

Gateway:
```bash
cd backend-node
npm run dev          # tsx watch on :8000
npm run typecheck    # tsc --noEmit
```

Agent service (run from project root):
```bash
python -u -m uvicorn agent_service.api.main:app --host 0.0.0.0 --port 8001
```

Frontend:
```bash
cd frontend
npm run dev          # :5173
npm run build
```

**Install:**
```bash
pip install -r agent_service/requirements.txt
cd backend-node && npm install
cd frontend && npm install
```

**Generate agent graph visualization:**
```bash
python scripts/gen_graph.py
```

## Environment

**`backend-node/.env`** (Gateway):
```
PORT=8000
LOG_LEVEL=debug
PYTHON_AGENT_URL=http://localhost:8001
BINANCE_BASE_URL=https://api.binance.com
COINGECKO_BASE_URL=https://api.coingecko.com
COINGECKO_API_KEY=        # optional, public endpoints work without it
```

**`agent_service/.env`** (Agent):
```
AI_API_KEY=<Google Gemini API key — required>
AI_MODEL=gemini-2.0-flash
LOG_LEVEL=DEBUG
PYTHONUNBUFFERED=1        # critical on Windows for live log streaming
```

Settings are loaded via pydantic-settings in `agent_service/settings.py` and `@fastify/env` in `backend-node/src/config.ts`.

## Architecture

### Request flow

```
Frontend (Vite :5173)
    └─► proxy /api/* → Gateway (:8000)
            ├─► Binance API           (heatmap, klines, ticker/banner)
            ├─► CoinGecko API         (trending)
            └─► Agent Service (:8001) (chat → POST /run-agent)
                    └─► LangGraph + Gemini
```

### Gateway (`backend-node/`)

- **`src/server.ts`** — Fastify bootstrap with Pino (`pino-pretty` in dev), `@fastify/env`, `@fastify/cors`, TypeBox type provider.
- **`src/config.ts`** — `ConfigSchema` (TypeBox) defines and validates env at startup.
- **`src/clients/`** — `binance.ts`, `coingecko.ts`, `pythonAgent.ts`. Each one is instantiated per request with the current `request.log` so logs are correlated with `reqId`.
- **`src/schemas/`** — TypeBox schemas. `market.ts` shapes match what the React components consume; `chat.ts` includes `AgentStateSchema` mirroring the Python `ChatState` for debug logging.
- **`src/routes/`** — one file per endpoint. All use `FastifyPluginAsyncTypebox` so request/response are typed and validated.

### Agent Service (`agent_service/`)

- **`api/main.py`** — minimal FastAPI app exposing only `POST /run-agent` and `GET /health`. Compiles the graph once at startup.
- **`agents/chat/graph.py`** — LangGraph `StateGraph` definition.
- **`agents/chat/nodes.py`** — async node functions updating `ChatState`. Uses `binance/` and `coingecko.py` internally (price_fetcher, market_scout, coin_info nodes).
- **`agents/shared/state.py`** — `ChatState` TypedDict with all 13 optional fields.

LangGraph flow:
```
intent_router
├─► market_scout → END             (market_overview intent)
├─► no_symbol → END                (coin not identified)
├─► coin_info → END                (fundamentals via CoinGecko)
└─► price_fetcher → data_validator
        ├─► price_only → END       (price_only intent or bad data)
        └─► chart_analyst → finance_expert → crypto_expert → reviewer → END
```

`reviewer` synthesizes the three specialist analyses into a final Spanish-language report with BUY/SELL/HOLD recommendation and a Binance trading link. Every node has try/except with a degraded fallback response.

### Contract between Gateway and Agent

- Gateway sends: `POST :8001/run-agent { "message": string }`
- Agent returns: full `ChatState` serialized as JSON (every field optional).
- Gateway flattens to `{ "response": string }` for the frontend. The full state is logged at debug level (`request.log.debug({ state }, ...)`) so the entire agent run can be traced from gateway logs alone.

### Frontend

- **`App.jsx`** — `TickerBanner` (top), sidebar (ConversationHistory + Heatmap + TrendingPanel), main area (ChatPanel).
- **`ChatPanel.jsx`** — ref-forwarded; `injectText(ticker)` and `reset()` let sidebar components inject coin symbols into chat.
- `/api/*` requests are proxied by Vite (`vite.config.js`) to `localhost:8000` (the gateway).
- Clicking a coin in Heatmap or TrendingPanel calls `chatRef.current.injectText(ticker)`, which auto-populates and submits the chat input.

No UI component library — custom CSS per component.

## LLM response handling

`langchain-google-genai` returns `response.content` as either a string OR a list of content blocks like `[{'type': 'text', 'text': '...', 'extras': {...}}]` depending on the model and SDK version. The `_extract_text()` helper in `agent_service/agents/chat/nodes.py` normalizes both shapes. Always go through it instead of reading `.content` directly.

## Reviewer output format

The reviewer node returns Markdown that the frontend renders via `react-markdown`. Structure (enforced by the prompt):

```
## Recomendación
- 📈 **Short term:** BUY | SELL | HOLD
- 📊 **Medium term:** BUY | SELL | HOLD
- 🔭 **Long term:** BUY | SELL | HOLD

## Análisis
<6-8 sentences>

_Esto no es asesoramiento financiero._
```

Recommendations go first on purpose — they're the actionable summary. The Binance trading link is injected by `_inject_binance_link()` after the reviewer returns.
