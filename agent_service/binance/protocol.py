from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class TickerData:
    symbol: str
    price: float
    change_pct: float
    high: float
    low: float
    volume: float


class BinanceProtocol(Protocol):
    async def get_ticker(self, symbol: str) -> TickerData: ...
    async def get_all_tickers(self) -> list[TickerData]: ...
    async def get_klines(
        self, symbol: str, interval: str = "4h", limit: int = 42
    ) -> list[dict]: ...
