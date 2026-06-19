from __future__ import annotations

import logging
import time

from langchain_core.messages import HumanMessage, SystemMessage

from ....binance import create_binance_client
from ....binance.protocol import TickerData
from ...shared.state import ChatState
from ._helpers import _extract_text, _inject_binance_link, _llm, _log_llm
from ._symbols import SYMBOLS

logger = logging.getLogger(__name__)

_CORE_SET = set(SYMBOLS)
_ANCHORS = ("BTCUSDT", "ETHUSDT")

# CORE = curated universe the rest of the agent can analyze + explain confidently.
# WIDE = whatever else Binance lists with deep liquidity. Recommended only when
# the user explicitly asks for a high-risk profile. Coins outside CORE may not
# have a clean CoinGecko match — coin_info will say so honestly instead of
# making things up.
_CORE_MAX_24H = 50.0
_WIDE_MAX_24H = 100.0
_WIDE_TOP_BY_VOLUME = 30


def _fmt_row(t: TickerData) -> str:
    return f"  {t.symbol}: ${t.price:,.4f} ({t.change_pct:+.2f}%)\n"


def _build_universes(tickers: list[TickerData]) -> tuple[list[TickerData], list[TickerData], list[TickerData]]:
    """Return (anchors, core_momentum, wide_momentum)."""
    usdt_pairs = [t for t in tickers if t.symbol.endswith("USDT")]

    core_universe = [
        t for t in usdt_pairs
        if t.symbol in _CORE_SET and abs(t.change_pct) < _CORE_MAX_24H
    ]
    by_symbol = {t.symbol: t for t in core_universe}
    anchors = [by_symbol[s] for s in _ANCHORS if s in by_symbol]
    core_momentum = sorted(
        (t for t in core_universe if t.symbol not in _ANCHORS),
        key=lambda t: t.change_pct,
        reverse=True,
    )[:4]

    # WIDE: top liquidity outside CORE, sane volatility filter so we don't
    # promote obvious pumps. Take by volume first to filter out illiquid
    # tickers, then sort what survives by 24h gain.
    high_liquidity = sorted(
        (t for t in usdt_pairs if t.symbol not in _CORE_SET and abs(t.change_pct) < _WIDE_MAX_24H),
        key=lambda t: t.volume,
        reverse=True,
    )[:_WIDE_TOP_BY_VOLUME]
    wide_momentum = sorted(high_liquidity, key=lambda t: t.change_pct, reverse=True)[:8]

    return anchors, core_momentum, wide_momentum


async def advisor(state: ChatState) -> ChatState:
    user_message = state.get("user_message", "")

    client = create_binance_client()
    anchors: list[TickerData] = []
    core_momentum: list[TickerData] = []
    wide_momentum: list[TickerData] = []
    try:
        tickers = await client.get_all_tickers()
        anchors, core_momentum, wide_momentum = _build_universes(tickers)

        if anchors or core_momentum or wide_momentum:
            market_data = "🪨 ANCLAS (blue-chip 24h, BTC/ETH):\n"
            for t in anchors:
                market_data += _fmt_row(t)
            market_data += "\n📊 CORE — universo conservador, blue-chip alts (24h):\n"
            for t in core_momentum:
                market_data += _fmt_row(t)
            market_data += "\n🚀 WIDE — universo agresivo, alta liquidez fuera del CORE (24h):\n"
            for t in wide_momentum:
                market_data += _fmt_row(t)
        else:
            market_data = "Datos de mercado no disponibles."
    except Exception as exc:
        logger.warning("advisor data fetch failed: %s", exc)
        market_data = "Datos de mercado no disponibles."

    system = SystemMessage(
        content=(
            "Sos un asistente cripto conversacional que sugiere ideas de inversión "
            "basadas estrictamente en los datos de mercado provistos abajo. "
            "REGLA CRÍTICA: SOLO podés mencionar criptomonedas que aparezcan en ANCLAS, CORE o WIDE. "
            "Cualquier otra moneda (de tu conocimiento previo) está PROHIBIDA. "
            "REGLA CRÍTICA: NO inventes precios, porcentajes ni nombres de monedas.\n\n"
            "PERFIL DE RIESGO — primero detectá el perfil leyendo la pregunta del usuario:\n"
            "- ALTO: el usuario menciona 'riesgo alto', 'agresivo', 'más rendimiento', "
            "'tolero riesgo', 'apostar', 'memecoins', 'shitcoins', 'high risk' o equivalente.\n"
            "- BAJO: el usuario menciona 'conservador', 'seguro', 'sin riesgo', 'primera vez', "
            "'no quiero perder', 'principiante' o equivalente.\n"
            "- MODERADO: cualquier otro caso (es el default).\n\n"
            "DISTRIBUCIÓN según perfil:\n"
            "- BAJO: 70-90% en ANCLAS (BTC y/o ETH), el resto en 1 alt del CORE. Máx 3 monedas.\n"
            "- MODERADO: 50-60% en ANCLAS, 30-40% en CORE momentum, hasta 10-15% en una WIDE. Máx 4 monedas.\n"
            "- ALTO: 30-40% en ANCLAS (recomendable mantenerlas como base), 60-70% repartido entre "
            "CORE + WIDE con énfasis en WIDE. Hasta 5-6 monedas, máximo 25% en una sola.\n\n"
            "Tono: cálido, directo, en español rioplatense. Arrancá retomando lo que el usuario preguntó "
            "y mencioná explícitamente el perfil detectado "
            "(ej: 'Si vas con riesgo alto, lo que yo armaría es...', "
            "'Con 1000 dólares y un perfil moderado lo más sano es...'). Nada de saludos formales.\n\n"
            "FORMATO:\n"
            "1) 1-2 oraciones de intro nombrando el perfil detectado.\n"
            "2) Distribución concreta con porcentajes y montos (si el usuario dio monto). "
            "Justificá cada moneda en una frase corta usando SOLO los datos provistos "
            "(precio actual, cambio 24h). NO uses conocimiento previo del proyecto.\n"
            "3) Una oración de advertencia explícita SI el perfil es ALTO: "
            "'Estas monedas son más volátiles y algunas pueden no tener información detallada disponible.'\n"
            "4) Una oración corta de riesgo general: no invertir lo que necesites para gastos básicos.\n"
            "5) Cerrá con: _Esto no es asesoramiento financiero._\n\n"
            "Máx 200 palabras. No uses code fences."
        )
    )
    user = HumanMessage(
        content=(
            f"Pregunta del usuario: \"{user_message}\"\n\n"
            f"Datos de mercado actuales:\n{market_data}\n\n"
            "Respondé siguiendo el formato del system message. "
            "Detectá el perfil de riesgo del usuario antes de armar la distribución."
        )
    )

    msgs = [system, user]
    t0 = time.perf_counter()
    try:
        llm = _llm(state, temperature=0.4)
        response = await llm.ainvoke(msgs)
        final = _extract_text(response)
        latency_ms = int((time.perf_counter() - t0) * 1000)
        _log_llm(state, "advisor", msgs, final, latency_ms)
    except Exception as exc:
        latency_ms = int((time.perf_counter() - t0) * 1000)
        _log_llm(state, "advisor", msgs, None, latency_ms, error=str(exc))
        logger.warning("advisor LLM failed: %s", exc)
        final = (
            "No pude generar una recomendación en este momento. "
            f"Igual te dejo un vistazo rápido del mercado:\n\n{market_data}\n\n"
            "_Esto no es asesoramiento financiero._"
        )

    for t in (anchors + core_momentum + wide_momentum)[:4]:
        final = _inject_binance_link(final, t.symbol)

    return {"response": final}
