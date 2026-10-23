"""LangChain-powered streaming recipe adaptation."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from typing import Any

from fastapi import Response
from fastapi.responses import JSONResponse, StreamingResponse
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openrouter import ChatOpenRouter

from backend.prompt import build_adapt_system_prompt, build_adapt_user_prompt

UNAVAILABLE_MESSAGE = "The AI service is unavailable right now. Please try again shortly."
MISSING_CONFIG_MESSAGE = "The AI service is not configured."
INTERRUPTED_MESSAGE = "Recipe adaptation was interrupted. Please try again."


def _create_model(api_key: str, model_name: str) -> ChatOpenRouter:
    return ChatOpenRouter(model=model_name, api_key=api_key)


async def _close_iterator(iterator: AsyncIterator[Any]) -> None:
    close = getattr(iterator, "aclose", None)
    if close is not None:
        try:
            await close()
        except Exception:
            pass


async def create_adaptation_response(dish: Any, profile: Any) -> Response:
    api_key = os.environ.get("AI_API_KEY")
    model_name = os.environ.get("AI_MODEL")
    if not api_key or not model_name:
        return JSONResponse({"error": MISSING_CONFIG_MESSAGE}, status_code=502)

    messages = [
        SystemMessage(content=build_adapt_system_prompt()),
        HumanMessage(content=build_adapt_user_prompt(dish, profile)),
    ]

    iterator: AsyncIterator[Any] | None = None
    first_chunk: str | None = None
    try:
        iterator = _create_model(api_key, model_name).astream(messages).__aiter__()
        while first_chunk is None:
            chunk = await anext(iterator)
            text = chunk.text
            if isinstance(text, str) and text:
                first_chunk = text
    except StopAsyncIteration:
        if iterator is not None:
            await _close_iterator(iterator)
        return JSONResponse({"error": UNAVAILABLE_MESSAGE}, status_code=502)
    except Exception:
        if iterator is not None:
            await _close_iterator(iterator)
        return JSONResponse({"error": UNAVAILABLE_MESSAGE}, status_code=502)

    async def stream_text() -> AsyncIterator[str]:
        try:
            yield first_chunk
            async for chunk in iterator:
                text = chunk.text
                if isinstance(text, str) and text:
                    yield text
        except Exception:
            raise RuntimeError(INTERRUPTED_MESSAGE) from None
        finally:
            await _close_iterator(iterator)

    return StreamingResponse(stream_text(), media_type="text/plain; charset=utf-8")
