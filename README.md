# Crypto Intelligence Dashboard

Full-stack crypto dashboard with a LangGraph-powered chat assistant, real-time market widgets, Google OAuth login, and an admin audit dashboard that records every LLM call the agent makes.

## Stack

- **Frontend** — React 19 + Vite + Tailwind v4 + React Router. Charts via `lightweight-charts` (TradingView). Auth via Supabase JS SDK.
- **Gateway** — Fastify 5 + TypeScript + TypeBox. Proxies market data (Binance, CoinGecko) and chat (to the agent service). Validates JWTs from Supabase Auth.
- **Agent service** — FastAPI + LangGraph + `langchain-google-genai`. Multi-node graph: `intent_router → (market_scout | coin_info | no_symbol | off_topic | price_fetcher → data_validator → price_only | chart_analyst → finance_expert → crypto_expert → reviewer)`.
- **Persistence** — Supabase (Postgres + Auth). Two custom tables: `chats` and `node_traces`.

## Features

- Conversational crypto analyst (Spanish) backed by Google Gemini. Handles price queries, coin info, market overview, and multi-step trading analysis.
- Conversation memory carry-over for implicit references (e.g. *"¿debería vender?"* after a TRX analysis) without leaking context into off-topic questions.
- Live ticker banner, market heatmap, trending coins, candlestick chart for the active symbol.
- **Google OAuth** login (Supabase) — the chat is gated; logged-out users see a CTA.
- **Model selector** — choose between Gemini 3.1 / 2.0 / 1.5 variants. Choice persists in `localStorage`.
- **Admin dashboard** at `/admin` — drill-down from sessions → chats → per-node LLM traces (prompts + responses + latency + errors). Access restricted to emails in `ADMIN_EMAILS`.
- Inline disclaimer permanently visible below the input.

## Quick start

### 1. Supabase setup (one-time)

1. Create a project at [supabase.com](https://supabase.com) (free tier is enough).
2. **Authentication → Providers → Google**: enable, paste a Google OAuth Client ID + Secret. The callback URI Supabase shows you (`https://<proj>.supabase.co/auth/v1/callback`) must be added to your Google Cloud OAuth client as an authorized redirect URI.
3. **SQL Editor** → paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and run.
4. **Project Settings → API**: copy `URL`, `anon` key, and `service_role` key.

### 2. Env files

Create three `.env` files from the examples:

`backend-node/.env`:
```
PORT=8000
LOG_LEVEL=debug
PYTHON_AGENT_URL=http://localhost:8001
BINANCE_BASE_URL=https://api.binance.com
COINGECKO_BASE_URL=https://api.coingecko.com
SUPABASE_URL=https://<proj>.supabase.co
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
ADMIN_EMAILS=you@example.com
```

`agent_service/.env`:
```
AI_API_KEY=<Google Gemini API key>
AI_MODEL=gemini-3.1-flash-lite
LOG_LEVEL=DEBUG
PYTHONUNBUFFERED=1
SUPABASE_URL=https://<proj>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

`frontend/.env`:
```
VITE_SUPABASE_URL=https://<proj>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_ADMIN_EMAILS=you@example.com
```

> The three `SUPABASE_URL` values MUST point at the same project — otherwise the agent writes traces to one DB while the gateway writes chats to another, and the admin dashboard shows empty traces.

### 3. Install deps

```bash
pip install -r agent_service/requirements.txt
cd backend-node && npm install
cd ../frontend && npm install
```

### 4. Run

Windows convenience: `start.bat` opens three windows (frontend + gateway + agent).

Manual, one window per service:

```bash
# Gateway (port 8000)
cd backend-node && npm run dev

# Agent service (port 8001) — run from project root
python -u -m uvicorn agent_service.api.main:app --host 0.0.0.0 --port 8001

# Frontend (port 5173)
cd frontend && npm run dev
```

Open <http://localhost:5173>, log in with Google, and chat.

API documentation (dev only): <http://localhost:8000/docs>.

## Project layout

```
frontend/          React app (port 5173)
  src/auth/        Supabase Auth provider + ProtectedRoute
  src/pages/       AdminDashboard
  src/components/  ChatPanel, CandleChart, Heatmap, Select, ...
  src/lib/         Supabase client
backend-node/      Fastify gateway (port 8000)
  src/plugins/     supabase, auth, swagger, binance, coingecko, pythonAgent
  src/routes/      chat, admin, health, heatmap, klines, ticker/banner, trending
  src/clients/     Typed wrappers around upstream APIs
  src/schemas/     TypeBox request/response schemas
agent_service/     LangGraph multi-agent (port 8001)
  agents/chat/     graph + nodes (intent_router, chart_analyst, ...)
  api/main.py      FastAPI POST /run-agent
  supabase_client.py  fire-and-forget audit writes
shared/types/      TypeScript contracts shared by frontend + gateway
supabase/          schema.sql migration
```

## Notes

- The chat is **client-side stateful** — refreshing resets the conversation. There is no server-side message store; only audit (chats + node_traces).
- Audit writes from the agent are fire-and-forget. They never block the LangGraph flow and never bubble exceptions; missing audit shows up only in the admin dashboard.
- The reviewer node returns Spanish Markdown with a `Recomendación / Análisis / disclaimer` structure plus a Binance trading link.

See [CLAUDE.md](CLAUDE.md) for in-depth architectural notes, contract details, and gotchas.
