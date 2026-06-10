from __future__ import annotations

import json
import logging
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from ...binance import create_binance_client
from ...coingecko import get_coin_info
from ...settings import settings
from ..shared.state import ChatState

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _llm(temperature: float = 0.3) -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=settings.AI_MODEL,
        temperature=temperature,
        google_api_key=settings.AI_API_KEY,
    )


def _extract_text(response: Any) -> str:
    """Normalize the LLM response into a plain string.

    Newer versions of langchain-google-genai return `response.content` as a
    list of content blocks (e.g. ``[{'type': 'text', 'text': '...', 'extras': {...}}]``)
    instead of a plain string. Callers that just stringify the list end up
    leaking the raw Python repr into the UI. This helper handles both shapes.
    """
    content = getattr(response, "content", response)

    if isinstance(content, str):
        return content

    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict):
                # Gemini text block
                if "text" in block and isinstance(block["text"], str):
                    parts.append(block["text"])
                elif isinstance(block.get("content"), str):
                    parts.append(block["content"])
            elif isinstance(block, str):
                parts.append(block)
        if parts:
            return "\n".join(parts)

    return str(content)


def _log_llm(node: str, messages: list, response: str) -> None:
    logger.debug(
        "[%s] LLM call — messages=%d, response_len=%d",
        node,
        len(messages),
        len(response),
    )


def _binance_trade_url(symbol: str) -> str:
    base = symbol.replace("USDT", "")
    return f"https://www.binance.com/en/trade/{base}_USDT"


def _inject_binance_link(text: str, symbol: str) -> str:
    base = symbol.replace("USDT", "")
    url = _binance_trade_url(symbol)
    bold = f"**{base}**"
    if bold in text:
        return text.replace(bold, f"**[{base}]({url})**", 1)
    if base in text:
        return text.replace(base, f"[{base}]({url})", 1)
    return f"{text}\n\n[Operar {base} en Binance]({url})"


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------

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


def _format_history_for_router(history: list[dict] | None, max_turns: int = 20) -> str:
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


# ---------------------------------------------------------------------------
# intent_router
# ---------------------------------------------------------------------------


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

    try:
        llm = _llm(temperature=0)
        response = await llm.ainvoke([system, user])
        text = _extract_text(response)
        _log_llm("intent_router", [system, user], text)

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


# ---------------------------------------------------------------------------
# no_symbol_response
# ---------------------------------------------------------------------------


async def no_symbol_response(state: ChatState) -> ChatState:
    return {
        "response": (
            "No identifiqué ninguna criptomoneda en tu mensaje. "
            "¿Podés especificar cuál te interesa? "
            f"Algunas opciones: {', '.join(s.replace('USDT', '') for s in SYMBOLS[:8])}..."
        )
    }


# ---------------------------------------------------------------------------
# off_topic_response
# ---------------------------------------------------------------------------


async def off_topic_response(state: ChatState) -> ChatState:
    return {
        "response": (
            "Soy un asistente especializado en criptomonedas. "
            "No puedo ayudarte con esa consulta, pero preguntame sobre "
            "cualquier moneda — precio, análisis técnico, o qué es y cómo funciona."
        )
    }


# ---------------------------------------------------------------------------
# price_fetcher
# ---------------------------------------------------------------------------


async def price_fetcher(state: ChatState) -> ChatState:
    symbol = state.get("symbol", "BTCUSDT")
    client = create_binance_client()

    try:
        ticker = await client.get_ticker(symbol)
        price_context = (
            f"Symbol: {symbol}\n"
            f"Price: ${ticker.price:,.2f}\n"
            f"24h Change: {ticker.change_pct:+.2f}%\n"
            f"24h High: ${ticker.high:,.2f}\n"
            f"24h Low: ${ticker.low:,.2f}\n"
            f"24h Volume: {ticker.volume:,.0f}"
        )
    except Exception as exc:
        logger.warning("price_fetcher failed for %s: %s", symbol, exc)
        price_context = f"Symbol: {symbol}\nPrice data unavailable."

    try:
        klines_7d = await client.get_klines(symbol, interval="4h", limit=42)
        klines_7d_data = [
            {
                "open_time": k["open_time"],
                "open": k["open"],
                "high": k["high"],
                "low": k["low"],
                "close": k["close"],
                "volume": k["volume"],
            }
            for k in klines_7d
        ]
    except Exception as exc:
        logger.warning("klines fetch failed for %s: %s", symbol, exc)
        klines_7d_data = []

    return {
        "price_context": price_context,
        "klines_7d": klines_7d_data,
    }


# ---------------------------------------------------------------------------
# data_validator
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# price_only
# ---------------------------------------------------------------------------


async def price_only(state: ChatState) -> ChatState:
    symbol = state.get("symbol", "BTCUSDT")
    price_context = state.get("price_context", "No data")
    link = f"[Operar en Binance]({_binance_trade_url(symbol)})"
    response = f"📊 **{symbol}**\n\n{price_context}\n\n{link}"
    return {"response": response}


# ---------------------------------------------------------------------------
# market_scout
# ---------------------------------------------------------------------------


async def market_scout(state: ChatState) -> ChatState:
    client = create_binance_client()
    try:
        tickers = await client.get_all_tickers()
        usdt_pairs = [t for t in tickers if t.symbol.endswith("USDT")]
        top_gainers = sorted(usdt_pairs, key=lambda t: t.change_pct, reverse=True)[:5]
        top_losers = sorted(usdt_pairs, key=lambda t: t.change_pct)[:5]

        market_data = "📈 TOP GAINERS (24h):\n"
        for t in top_gainers:
            market_data += f"  {t.symbol}: ${t.price:,.4f} ({t.change_pct:+.2f}%)\n"
        market_data += "\n📉 TOP LOSERS (24h):\n"
        for t in top_losers:
            market_data += f"  {t.symbol}: ${t.price:,.4f} ({t.change_pct:+.2f}%)\n"
    except Exception as exc:
        logger.warning("market_scout data fetch failed: %s", exc)
        market_data = "Market data unavailable."

    system = SystemMessage(
        content=(
            "You are a crypto market analyst. Summarize the market overview based on the data. "
            "CRITICAL RULE: you may ONLY use the market data provided below. "
            "Do NOT invent prices or percentages. "
            "Always respond in Spanish. No greetings or filler. "
            "Write 4-6 sentences. End with a brief disclaimer: 'Esto no es asesoramiento financiero.'"
        )
    )
    user = HumanMessage(
        content=f"User: {state.get('user_message', '')}\n\nMarket data:\n{market_data}"
    )

    try:
        llm = _llm()
        response = await llm.ainvoke([system, user])
        final = _extract_text(response)
        _log_llm("market_scout", [system, user], final)
    except Exception as exc:
        logger.warning("market_scout LLM failed: %s", exc)
        final = market_data

    for t in top_gainers[:5]:
        final = _inject_binance_link(final, t.symbol)

    return {"response": final}


# ---------------------------------------------------------------------------
# chart_analyst
# ---------------------------------------------------------------------------


async def chart_analyst(state: ChatState) -> ChatState:
    symbol = state.get("symbol", "BTCUSDT")
    klines = state.get("klines_7d", [])
    price_context = state.get("price_context", "")

    klines_summary = ""
    if klines:
        closes = [k["close"] for k in klines]
        highs = [k["high"] for k in klines]
        lows = [k["low"] for k in klines]
        klines_summary = (
            f"7d OHLC ({len(klines)} candles, 4h):\n"
            f"  Range: ${min(lows):,.2f} - ${max(highs):,.2f}\n"
            f"  Open: ${closes[0]:,.2f} → Close: ${closes[-1]:,.2f}\n"
            f"  Trend: {'UP' if closes[-1] > closes[0] else 'DOWN'} "
            f"({((closes[-1] - closes[0]) / closes[0] * 100):+.2f}%)"
        )

    system = SystemMessage(
        content=(
            "You are a technical chart analyst for crypto. "
            "CRITICAL RULE: base your analysis ONLY on the price and kline data provided. "
            "Do NOT use prior knowledge about this coin. "
            "Identify support/resistance levels, trend direction, and key patterns. "
            "Always respond in Spanish. No greetings or filler. "
            "Write 5-6 sentences."
        )
    )
    user = HumanMessage(
        content=(
            f"Symbol: {symbol}\n{price_context}\n\n{klines_summary}\n\n"
            "Provide technical analysis based strictly on this data."
        )
    )

    try:
        llm = _llm()
        response = await llm.ainvoke([system, user])
        analysis = _extract_text(response)
        _log_llm("chart_analyst", [system, user], analysis)
    except Exception as exc:
        logger.error("chart_analyst failed: %s", exc, exc_info=True)
        analysis = f"Technical analysis unavailable for {symbol}."

    return {"chart_analysis": analysis}


# ---------------------------------------------------------------------------
# finance_expert
# ---------------------------------------------------------------------------


async def finance_expert(state: ChatState) -> ChatState:
    symbol = state.get("symbol", "BTCUSDT")
    price_context = state.get("price_context", "")
    chart = state.get("chart_analysis", "")

    system = SystemMessage(
        content=(
            "You are a financial analyst specializing in crypto markets. "
            "CRITICAL RULE: base your analysis ONLY on the data provided. "
            "Do NOT use prior knowledge. "
            "Focus on risk/reward, volatility assessment, and market positioning. "
            "Always respond in Spanish. No greetings or filler. "
            "Write 4-5 sentences."
        )
    )
    user = HumanMessage(
        content=(
            f"Symbol: {symbol}\n{price_context}\n\n"
            f"Technical analysis:\n{chart}\n\n"
            "Provide financial analysis based strictly on this data."
        )
    )

    try:
        llm = _llm()
        response = await llm.ainvoke([system, user])
        analysis = _extract_text(response)
        _log_llm("finance_expert", [system, user], analysis)
    except Exception as exc:
        logger.warning("finance_expert failed: %s", exc)
        analysis = f"Financial analysis unavailable for {symbol}."

    return {"finance_analysis": analysis}


# ---------------------------------------------------------------------------
# crypto_expert
# ---------------------------------------------------------------------------


async def crypto_expert(state: ChatState) -> ChatState:
    symbol = state.get("symbol", "BTCUSDT")
    price_context = state.get("price_context", "")
    chart = state.get("chart_analysis", "")
    finance = state.get("finance_analysis", "")

    system = SystemMessage(
        content=(
            "You are a crypto ecosystem expert. "
            "CRITICAL RULE: base your analysis ONLY on the data provided. "
            "Do NOT use prior knowledge about this coin's fundamentals. "
            "Focus on on-chain signals, ecosystem context, and sentiment from the data. "
            "Always respond in Spanish. No greetings or filler. "
            "Write 4-5 sentences."
        )
    )
    user = HumanMessage(
        content=(
            f"Symbol: {symbol}\n{price_context}\n\n"
            f"Technical analysis:\n{chart}\n\n"
            f"Financial analysis:\n{finance}\n\n"
            "Provide crypto ecosystem analysis based strictly on this data."
        )
    )

    try:
        llm = _llm()
        response = await llm.ainvoke([system, user])
        analysis = _extract_text(response)
        _log_llm("crypto_expert", [system, user], analysis)
    except Exception as exc:
        logger.warning("crypto_expert failed: %s", exc)
        analysis = f"Crypto analysis unavailable for {symbol}."

    return {"crypto_analysis": analysis}


# ---------------------------------------------------------------------------
# reviewer
# ---------------------------------------------------------------------------


async def reviewer(state: ChatState) -> ChatState:
    symbol = state.get("symbol", "BTCUSDT")
    price_context = state.get("price_context", "")
    chart = state.get("chart_analysis", "")
    finance = state.get("finance_analysis", "")
    crypto = state.get("crypto_analysis", "")

    system = SystemMessage(
        content=(
            "You are a senior crypto analyst that synthesizes multiple analyses into a final report. "
            "CRITICAL RULE: you may ONLY use the analyses and data provided below. "
            "Do NOT add information from prior knowledge. "
            "Always respond in Spanish. No greetings or filler.\n\n"
            "OUTPUT FORMAT (follow EXACTLY, including the markdown):\n"
            "## Recomendación\n"
            "- 📈 **Short term:** BUY | SELL | HOLD\n"
            "- 📊 **Medium term:** BUY | SELL | HOLD\n"
            "- 🔭 **Long term:** BUY | SELL | HOLD\n\n"
            "## Análisis\n"
            "<6-8 sentences synthesizing the three analyses, 150-250 words>\n\n"
            "_Esto no es asesoramiento financiero._\n\n"
            "Rules:\n"
            "- Pick exactly ONE of BUY, SELL, HOLD for each horizon.\n"
            "- Do NOT wrap the response in code fences.\n"
            "- Do NOT add any text before '## Recomendación'."
        )
    )
    user = HumanMessage(
        content=(
            f"Symbol: {symbol}\n{price_context}\n\n"
            f"Technical analysis:\n{chart}\n\n"
            f"Financial analysis:\n{finance}\n\n"
            f"Crypto analysis:\n{crypto}\n\n"
            "Synthesize into a final report with recommendations."
        )
    )

    try:
        llm = _llm()
        response = await llm.ainvoke([system, user])
        final = _extract_text(response)
        _log_llm("reviewer", [system, user], final)
    except Exception as exc:
        logger.warning("reviewer failed: %s", exc)
        final = (
            f"Análisis de {symbol}:\n\n"
            f"{chart}\n\n{finance}\n\n{crypto}\n\n"
            "Esto no es asesoramiento financiero."
        )

    final = _inject_binance_link(final, symbol)
    return {"response": final}


# ---------------------------------------------------------------------------
# coin_info_responder
# ---------------------------------------------------------------------------


async def coin_info_responder(state: ChatState) -> ChatState:
    symbol = state.get("symbol", "BTCUSDT")
    user_message = state.get("user_message", "")

    if not symbol:
        return {
            "response": "No identifiqué ninguna criptomoneda en tu mensaje. ¿Podés especificar cuál te interesa?"
        }

    info = await get_coin_info(symbol)
    if not info:
        base = symbol.replace("USDT", "")
        return {
            "response": f"No tengo información fundamental sobre **{base}** en este momento."
        }

    system = SystemMessage(
        content=(
            "You are a crypto educator that explains what a cryptocurrency is in simple terms. "
            "CRITICAL RULE: you may ONLY respond based on the coin data provided in this message. "
            "Do NOT use prior knowledge about this coin or any other coin. "
            "If the data is insufficient, say so explicitly. "
            "Always respond in Spanish. No greetings or filler — go straight to the explanation. "
            "Format: a concise explanation (under 150 words) covering what the coin is, "
            "its purpose, and key technical characteristics. Use the provided data only."
        )
    )
    user = HumanMessage(
        content=(
            f"User question: \"{user_message}\"\n\n"
            f"Coin data (from CoinGecko):\n{info}\n\n"
            "Explain this coin to the user based strictly on the data above."
        )
    )

    try:
        msgs = [system, user]
        llm = _llm()
        response = await llm.ainvoke(msgs)
        final = _extract_text(response)
        _log_llm("coin_info_responder", msgs, final)
    except Exception as exc:
        logger.warning("coin_info_responder LLM failed: %s", exc)
        final = f"Información de {symbol.replace('USDT', '')}:\n\n{info}"

    final = _inject_binance_link(final, symbol)
    logger.info("coin_info_responder complete for %s", symbol)
    return {"response": final}
