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
- **`src/clients/`** — `binance.ts`, `coingecko.ts`, `pythonAgent.ts`. Registered as Fastify decorators via `src/plugins/`, instantiated once at startup. Methods accept an optional `request.log` so logs stay correlated with `reqId`.
- **`src/plugins/`** — one Fastify plugin per client (`fastify-plugin` wrapper + `decorate` + module augmentation). Registered in `server.ts` BEFORE the routes.
- **`src/clients/_fetch.ts`** — `fetchWithTimeout` (AbortController) used by every upstream call.
- **`src/clients/_errors.ts`** — `UpstreamParseError`, `UpstreamShapeError`, `InvalidSymbolError`.
- **`src/utils/parseNum.ts`** — strict `Number()` replacement that throws on NaN.
- **`src/utils/market.ts`** — `topByVolume` used by `heatmap` and `tickerBanner` routes.
- **`src/schemas/`** — TypeBox schemas. `market.ts` defines `Ticker`/`Kline`/`TrendingCoin` shapes (validated runtime) plus assignability checks against the shared interfaces. `chat.ts` defines `ChatRequest` (with optional `history`) / `ChatResponse` (with optional `intent`, `symbol`).
- **`src/routes/`** — one file per endpoint. All use `FastifyPluginAsyncTypebox` so request/response are typed and validated. `klines` interval is a TypeBox literal union so invalid values get a 400 with a clear message (not a fake "Invalid symbol").

### Agent Service (`agent_service/`)

- **`api/main.py`** — minimal FastAPI app exposing only `POST /run-agent` and `GET /health`. Compiles the graph once at startup AND calls `_regenerate_graph_png()` so `artifacts/graph.png` reflects the current pipeline every time the service boots. Failure of the regeneration is logged at warning level and does not block startup.
- **`agents/chat/graph.py`** — LangGraph `StateGraph` definition.
- **`agents/chat/nodes.py`** — async node functions updating `ChatState`. Uses `binance/` and `coingecko.py` internally (price_fetcher, market_scout, coin_info nodes). `intent_router` is the only node that consumes `state["history"]` for symbol carryover.
- **`agents/shared/state.py`** — `ChatState` TypedDict; includes `history: list[ConversationTurn]` for conversation memory.

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

- Gateway sends: `POST :8001/run-agent { "message": string, "history"?: ConversationTurn[] }`
- Agent returns: full `ChatState` serialized as JSON (every field optional).
- Gateway flattens to `{ "response": string, "intent"?: string, "symbol"?: string | null }` for the frontend. `intent` and `symbol` are exposed so the frontend can stash them on the assistant message and replay them as compact history on the next turn. The full state is logged with `{intent, symbol, responseLength}` at debug level (NOT the full state — that includes kline arrays).

### Conversation memory

The chat is **client-side stateful**. The frontend (`ChatPanel.tsx`) keeps its `messages: Message[]` array and on every `POST /chat` builds a compact `history` via `buildHistory()`:

- User turns send `{role: 'user', content: <text>}`.
- Assistant turns send only `{role: 'assistant', symbol, intent}` — the long reviewer text is NOT sent. The router only needs the symbol to resolve implicit references.

Only the `intent_router` node consumes `state["history"]`. It does two things:

1. Renders the history as a Spanish context block in the system prompt so Gemini can resolve pronouns and elisions.
2. If neither the pattern matcher nor the LLM produced a symbol for the current turn, `_last_symbol_from_history()` runs as a final fallback and carries over the most recent assistant symbol. This is what makes "es buen momento para comprar?" resolve to SOL after the user previously asked "¿qué es SOL?".

History is capped at 20 turns (`MAX_HISTORY_TURNS` in `ChatPanel.tsx`). Refreshing the browser resets the conversation — there is no server-side store.

The shared shapes live at `shared/types/chat.ts` (`ConversationTurn`, extended `ChatRequest`/`ChatResponse`). Both the gateway TypeBox schemas and the frontend hooks reference them.

### Frontend

- **`App.tsx`** — `TickerBanner` (top), sidebar (Heatmap + TrendingPanel), main area (ChatPanel). Below 768px the sidebar collapses behind a hamburger button and slides in as an overlay drawer.
- **`ChatPanel.tsx`** — ref-forwarded; `injectText(ticker)` lets sidebar components inject coin symbols into chat. Cancels the previous in-flight request via `abortRef` when a new send fires.
- **`src/api.ts`** — `API_BASE` + `getJson`/`postJson` helpers (single source of truth for the gateway URL).
- **`src/hooks/{useFetch,usePolling}.ts`** — `AbortController`-aware data hooks used by every sidebar panel.
- **`src/styles/tokens.css`** — centralized CSS variables; no hex literals scattered across component CSS files.
- `/api/*` requests are proxied by Vite (`vite.config.ts`) to `localhost:8000` (the gateway).

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
