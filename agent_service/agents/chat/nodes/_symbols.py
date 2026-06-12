from __future__ import annotations

SYMBOLS = [
    "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT",
    "ADAUSDT", "DOGEUSDT", "DOTUSDT", "AVAXUSDT", "MATICUSDT",
    "LINKUSDT", "UNIUSDT", "ATOMUSDT", "LTCUSDT", "NEARUSDT",
]

FULL_NAME_MAP: dict[str, str] = {
    "bitcoin": "BTCUSDT",
    "ethereum": "ETHUSDT",
    "binance coin": "BNBUSDT",
    "solana": "SOLUSDT",
    "ripple": "XRPUSDT",
    "cardano": "ADAUSDT",
    "dogecoin": "DOGEUSDT",
    "polkadot": "DOTUSDT",
    "avalanche": "AVAXUSDT",
    "polygon": "MATICUSDT",
    "chainlink": "LINKUSDT",
    "uniswap": "UNIUSDT",
    "cosmos": "ATOMUSDT",
    "litecoin": "LTCUSDT",
    "near": "NEARUSDT",
}

SYMBOL_ALIASES: dict[str, str] = {}
for _s in SYMBOLS:
    _base = _s.replace("USDT", "")
    SYMBOL_ALIASES[_base] = _s
    SYMBOL_ALIASES[_base.lower()] = _s
    SYMBOL_ALIASES[_s] = _s
    SYMBOL_ALIASES[_s.lower()] = _s
for _name, _sym in FULL_NAME_MAP.items():
    SYMBOL_ALIASES[_name] = _sym


def _resolve_symbol(text: str) -> str | None:
    upper = text.upper().strip()
    for alias, sym in SYMBOL_ALIASES.items():
        if alias.upper() in upper:
            return sym
    return None


def _last_symbol_from_history(history: list[dict] | None) -> str | None:
    """Return the most recent non-null assistant `symbol` from history.

    Used as a last-resort fallback in the intent_router: if neither the
    pattern matcher nor the LLM detect a symbol in the current user message,
    we carry over the symbol from the previous assistant turn. This makes
    "es buen momento para comprar?" after "¿qué es SOL?" resolve to SOL.
    """
    if not history:
        return None
    for turn in reversed(history):
        if turn.get("role") == "assistant" and turn.get("symbol"):
            return turn["symbol"]
    return None


def _format_history_for_router(history: list[dict] | None, max_turns: int = 10) -> str:
    """Render the last N turns as a compact context block for the LLM.

    Keeps each entry to a single line. Only the symbol/intent matter for
    assistant turns; the full review text would just confuse the router.
    """
    if not history:
        return ""
    recent = history[-max_turns:]
    lines: list[str] = []
    for i, turn in enumerate(recent, start=1):
        role = turn.get("role", "?")
        if role == "user":
            content = (turn.get("content") or "").strip()
            if len(content) > 200:
                content = content[:200] + "..."
            lines.append(f"  {i}. Usuario: {content}")
        else:
            sym = turn.get("symbol") or "—"
            intent = turn.get("intent") or "—"
            lines.append(f"  {i}. Bot: respondió sobre {sym} (intent={intent})")
    return "\n".join(lines)
