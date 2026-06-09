from .real_client import BinanceRealClient


def create_binance_client() -> BinanceRealClient:
    return BinanceRealClient()
