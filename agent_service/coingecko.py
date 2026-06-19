from __future__ import annotations

import logging
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory caches
# ---------------------------------------------------------------------------
#
# `_id_cache`   maps a Binance-style symbol ("SHIBUSDT") to the resolved
#               CoinGecko id ("shiba-inu") OR `None` when /search returned
#               nothing. Caching the miss avoids hammering CoinGecko when the
#               user keeps asking about something it doesn't know about.
#
# `_info_cache` maps the resolved CoinGecko id to the formatted info string.
#               The id is the natural cache key because the same coin can be
#               reached through multiple symbol aliases.
#

_id_cache: dict[str, tuple[float, str | None]] = {}
_info_cache: dict[str, tuple[float, str]] = {}

_INFO_TTL = 3600      # 1 hour for the rendered info block
_ID_HIT_TTL = 86400   # 24 hours for resolved ids (gecko ids are stable)
_ID_MISS_TTL = 600    # 10 minutes for resolution misses (transient typos)

_GECKO_BASE = "https://api.coingecko.com/api/v3"


async def _resolve_gecko_id(symbol: str) -> str | None:
    """Resolve a Binance-style symbol to a CoinGecko coin id.

    Always goes through CoinGecko `/search` rather than a hardcoded mapping,
    so any coin CoinGecko indexes is reachable. Results are cached so each
    symbol incurs at most one /search call (per hit TTL).

    Returns the coin id, or `None` when CoinGecko has no record. The `None`
    is itself cached (with a shorter TTL) so we don't spam CoinGecko on the
    same miss. Network errors bypass the cache so a retry can succeed later.
    """
    now = time.time()
    cached = _id_cache.get(symbol)
    if cached is not None:
        ts, value = cached
        ttl = _ID_HIT_TTL if value is not None else _ID_MISS_TTL
        if now - ts < ttl:
            return value

    base = symbol.replace("USDT", "")
    url = f"{_GECKO_BASE}/search"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params={"query": base})
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("CoinGecko /search failed for %s: %s", base, exc)
        return None  # transient — do NOT cache so the next turn retries

    coins = data.get("coins") or []
    base_upper = base.upper()
    # Require an exact symbol match (case-insensitive). Falling back to the
    # first result by market-cap rank used to produce confused output for
    # exotic tickers — e.g. searching "RE" returned Ethereum because there is
    # no coin with symbol "RE" but ETH ranks high in CoinGecko search.
    # Better to say "I don't have data on this coin" than to describe a
    # different one.
    chosen: str | None = None
    for item in coins:
        if (item.get("symbol") or "").upper() == base_upper:
            chosen = item.get("id")
            break

    logger.debug("coingecko: searching for %r -> %s", base, chosen)
    _id_cache[symbol] = (now, chosen)
    return chosen


async def get_coin_info(symbol: str) -> str | None:
    """Return a formatted info block for `symbol`, or `None` if unknown.

    Resolution is two-stage:
      1. symbol -> gecko_id via `_resolve_gecko_id` (with cache).
      2. gecko_id -> formatted info via `/coins/{id}` (with cache).
    """
    gecko_id = await _resolve_gecko_id(symbol)
    if not gecko_id:
        return None

    now = time.time()
    cached = _info_cache.get(gecko_id)
    if cached is not None:
        ts, payload = cached
        if now - ts < _INFO_TTL:
            return payload

    try:
        url = f"{_GECKO_BASE}/coins/{gecko_id}"
        params = {
            "localization": "false",
            "tickers": "false",
            "market_data": "true",
            "community_data": "false",
            "developer_data": "false",
            "sparkline": "false",
        }
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        formatted = _format_coin_info(data)
        _info_cache[gecko_id] = (now, formatted)
        return formatted
    except Exception as exc:
        logger.warning("CoinGecko fetch failed for %s: %s", gecko_id, exc)
        return None


def _format_coin_info(data: dict[str, Any]) -> str:
    name = data.get("name", "Unknown")
    symbol = data.get("symbol", "").upper()
    desc = data.get("description", {}).get("en", "")
    if desc:
        desc = desc.split(". ")[0] + "."

    md = data.get("market_data", {})
    price = md.get("current_price", {}).get("usd", "N/A")
    mcap = md.get("market_cap", {}).get("usd", "N/A")
    rank = data.get("market_cap_rank", "N/A")
    ath = md.get("ath", {}).get("usd", "N/A")
    change_24h = md.get("price_change_percentage_24h", "N/A")
    change_7d = md.get("price_change_percentage_7d", "N/A")
    total_supply = md.get("total_supply", "N/A")
    circulating = md.get("circulating_supply", "N/A")
    genesis = data.get("genesis_date", "N/A")
    categories = ", ".join(data.get("categories", [])[:3]) or "N/A"
    hashing = data.get("hashing_algorithm", "N/A")

    def fmt_usd(val: Any) -> str:
        if isinstance(val, (int, float)):
            return f"${val:,.2f}"
        return str(val)

    def fmt_pct(val: Any) -> str:
        if isinstance(val, (int, float)):
            return f"{val:.2f}%"
        return str(val)

    def fmt_int(val: Any) -> str:
        if isinstance(val, (int, float)):
            return f"{val:,.0f}"
        return str(val)

    lines = [
        f"Name: {name} ({symbol})",
        f"Description: {desc}",
        f"Market Cap Rank: #{rank}",
        f"Price (USD): {fmt_usd(price)}",
        f"Market Cap: {fmt_usd(mcap)}",
        f"24h Change: {fmt_pct(change_24h)}",
        f"7d Change: {fmt_pct(change_7d)}",
        f"ATH: {fmt_usd(ath)}",
        f"Circulating Supply: {fmt_int(circulating)}",
        f"Total Supply: {fmt_int(total_supply)}",
        f"Genesis Date: {genesis}",
        f"Categories: {categories}",
        f"Hashing Algorithm: {hashing}",
    ]
    return "\n".join(lines)
