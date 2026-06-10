"""Generate the LangGraph pipeline visualization as PNG."""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)

logger.debug("Project root: %s", ROOT)
logger.debug("sys.path[0]: %s", sys.path[0])

from agent_service.agents.chat.graph import build_chat_graph  # noqa: E402

logger.debug("build_chat_graph imported successfully")


def main() -> None:
    logger.debug("Building chat graph...")
    graph = build_chat_graph()
    logger.debug("Graph built: %s", graph)

    out = ROOT / "artifacts" / "graph.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    logger.debug("Output path: %s", out)

    logger.debug("Rendering Mermaid PNG...")
    png_bytes = graph.get_graph().draw_mermaid_png()
    logger.debug("PNG rendered: %d bytes", len(png_bytes))

    out.write_bytes(png_bytes)
    logger.info("Graph saved to %s (%s bytes)", out, f"{len(png_bytes):,}")


if __name__ == "__main__":
    main()
