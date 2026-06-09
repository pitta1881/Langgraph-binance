from __future__ import annotations

import logging

import httpx

from .protocol import TickerData

logger = logging.getLogger(__name__)

BINANCE_BASE = "https://api.binance.com"


class BinanceRealClient:
    async def get_ticker(self, symbol: str) -> TickerData:
        url = f"{BINANCE_BASE}/api/v3/ticker/24hr"
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params={"symbol": symbol})
            resp.raise_for_status()
            data = resp.json()
        return TickerData(
            symbol=data["symbol"],
            price=float(data["lastPrice"]),
            change_pct=float(data["priceChangePercent"]),
            high=float(data["highPrice"]),
            low=float(data["lowPrice"]),
            volume=float(data["volume"]),
        )

    async def get_all_tickers(self) -> list[TickerData]:
        url = f"{BINANCE_BASE}/api/v3/ticker/24hr"
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
        return [
            TickerData(
                symbol=t["symbol"],
                price=float(t["lastPrice"]),
                change_pct=float(t["priceChangePercent"]),
                high=float(t["highPrice"]),
                low=float(t["lowPrice"]),
                volume=float(t["volume"]),
            )
            for t in data
            if t["symbol"].endswith("USDT")
        ]

    async def get_klines(
        self, symbol: str, interval: str = "4h", limit: int = 42
    ) -> list[dict]:
        url = f"{BINANCE_BASE}/api/v3/klines"
        params = {"symbol": symbol, "interval": interval, "limit": limit}
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        return [
            {
                "open_time": k[0],
                "open": float(k[1]),
                "high": float(k[2]),
                "low": float(k[3]),
                "close": float(k[4]),
                "volume": float(k[5]),
                "close_time": k[6],
            }
            for k in data
        ]
