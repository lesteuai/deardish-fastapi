from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any, cast

from backend import ai, main

app = main.app


class ControlledChunk:
    def __init__(self, text: str) -> None:
        self.text = text


class ControlledModel:
    def __init__(self, mode: str) -> None:
        self.mode = mode

    async def astream(self, _: list[Any]) -> AsyncIterator[ControlledChunk]:
        try:
            if self.mode == "pretext-error":
                raise RuntimeError("private provider detail")
            yield ControlledChunk("")
            yield ControlledChunk("Café ")
            if self.mode == "midstream-error":
                raise RuntimeError("private provider detail")
            if self.mode == "cancel":
                await asyncio.Event().wait()
            yield ControlledChunk("東京 🍲")
        finally:
            event_path = Path(os.environ["DEARDISH_TEST_AI_EVENTS"])
            with event_path.open("a", encoding="utf-8") as events:
                events.write(f"{self.mode}:closed\n")


def create_controlled_model(_: str, __: str) -> ControlledModel:
    mode_path = Path(os.environ["DEARDISH_TEST_AI_MODE"])
    return ControlledModel(mode_path.read_text(encoding="utf-8").strip())


ai._create_model = cast(Any, create_controlled_model)
