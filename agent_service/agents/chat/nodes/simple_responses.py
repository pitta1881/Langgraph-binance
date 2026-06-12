from __future__ import annotations

from ...shared.state import ChatState
from ._symbols import SYMBOLS


async def no_symbol_response(state: ChatState) -> ChatState:
    return {
        "response": (
            "No identifiqué ninguna criptomoneda en tu mensaje. "
            "¿Podés especificar cuál te interesa? "
            f"Algunas opciones: {', '.join(s.replace('USDT', '') for s in SYMBOLS[:8])}..."
        )
    }


async def off_topic_response(state: ChatState) -> ChatState:
    return {
        "response": (
            "Soy un asistente especializado en criptomonedas. "
            "No puedo ayudarte con esa consulta, pero preguntame sobre "
            "cualquier moneda — precio, análisis técnico, o qué es y cómo funciona."
        )
    }
