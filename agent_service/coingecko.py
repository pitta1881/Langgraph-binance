from __future__ import annotations

import logging
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

SYMBOL_TO_GECKO_ID: dict[str, str] = {
    "BTCUSDT": "bitcoin",
    "ETHUSDT": "ethereum",
    "BNBUSDT": "binancecoin",
    "SOLUSDT": "solana",
    "XRPUSDT": "ripple",
    "ADAUSDT": "cardano",
    "DOGEUSDT": "dogecoin",
    "DOTUSDT": "polkadot",
    "AVAXUSDT": "avalanche-2",
    "MATICUSDT": "matic-network",
    "LINKUSDT": "chainlink",
    "UNIUSDT": "uniswap",
    "ATOMUSDT": "cosmos",
    "LTCUSDT": "litecoin",
    "NEARUSDT": "near",
}

_cache: dict[str, tuple[float, str]] = {}
_CACHE_TTL = 3600  # 1 hour


async def get_coin_info(symbol: str) -> str | None:
    gecko_id = SYMBOL_TO_GECKO_ID.get(symbol)
    if not gecko_id:
        return None

    now = time.time()
    if gecko_id in _cache:
        ts, data = _cache[gecko_id]
        if now - ts < _CACHE_TTL:
            return data

    try:
        url = f"https://api.coingecko.com/api/v3/coins/{gecko_id}"
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
        _cache[gecko_id] = (now, formatted)
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
