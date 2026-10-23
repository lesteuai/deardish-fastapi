from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator, AsyncIterator
from types import SimpleNamespace
from typing import Any, cast

import pytest
from backend import ai
from backend.prompt import EMPTY_PROFILE_FALLBACK
from fastapi.responses import JSONResponse, StreamingResponse


class FakeModel:
    def __init__(self, chunks: AsyncIterator[Any]) -> None:
        self.chunks = chunks
        self.received_messages: list[Any] | None = None

    def astream(self, messages: list[Any]) -> AsyncIterator[Any]:
        self.received_messages = messages
        return self.chunks


class TrackedChunks:
    def __init__(self, chunks: list[Any]) -> None:
        self.chunks = iter(chunks)
        self.closed = False

    def __aiter__(self) -> TrackedChunks:
        return self

    async def __anext__(self) -> Any:
        try:
            return next(self.chunks)
        except StopIteration:
            raise StopAsyncIteration from None

    async def aclose(self) -> None:
        self.closed = True


def text_chunk(text: Any) -> SimpleNamespace:
    return SimpleNamespace(text=text)


def response_text(response: JSONResponse) -> str:
    return bytes(response.body).decode("utf-8")


@pytest.mark.asyncio
async def test_configures_openrouter_and_streams_unicode_text_with_empty_chunks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AI_API_KEY", "test-api-key")
    monkeypatch.setenv("AI_MODEL", "openrouter/test-model")
    chunks = TrackedChunks(
        [
            text_chunk(""),
            text_chunk("🍜 Crème brûlée tofu"),
            text_chunk(" and herbs."),
        ]
    )
    model = FakeModel(chunks)
    model_arguments: list[tuple[str, str]] = []

    def create_model(api_key: str, model_name: str) -> FakeModel:
        model_arguments.append((api_key, model_name))
        return model

    monkeypatch.setattr(ai, "_create_model", create_model)

    response = await ai.create_adaptation_response(
        {
            "name": "Citrus tofu",
            "cuisine": "Vietnamese",
            "description": "Bright and savory",
            "ingredients": ["tofu", "lime"],
            "content": "Press tofu, fry until crisp, and finish with lime.",
        },
        {"conditions": "hypertension", "allergies": "peanuts"},
    )

    assert isinstance(response, StreamingResponse)
    assert response.media_type == "text/plain; charset=utf-8"
    assert response.headers["content-type"] == "text/plain; charset=utf-8"
    assert model_arguments == [("test-api-key", "openrouter/test-model")]
    assert model.received_messages is not None
    assert "DearDish" in model.received_messages[0].content
    user_prompt = model.received_messages[1].content
    for value in (
        "Citrus tofu",
        "Vietnamese",
        "Bright and savory",
        "tofu, lime",
        "Press tofu, fry until crisp, and finish with lime.",
        "Conditions: hypertension",
        "Allergies: peanuts",
    ):
        assert value in user_prompt
    assert EMPTY_PROFILE_FALLBACK not in user_prompt

    parts = cast(list[str], [part async for part in response.body_iterator])
    assert "".join(parts).encode() == "🍜 Crème brûlée tofu and herbs.".encode()
    assert chunks.closed


@pytest.mark.asyncio
async def test_empty_profile_fallback_is_sent_to_model(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_API_KEY", "key")
    monkeypatch.setenv("AI_MODEL", "model")
    model = FakeModel(TrackedChunks([text_chunk("recipe")]))
    monkeypatch.setattr(ai, "_create_model", lambda *_: model)

    response = await ai.create_adaptation_response({"name": "Dish"}, {})

    assert isinstance(response, StreamingResponse)
    assert model.received_messages is not None
    assert EMPTY_PROFILE_FALLBACK in model.received_messages[1].content
    assert "Bolden any changes from the original recipe." in model.received_messages[0].content
    assert [part async for part in response.body_iterator] == ["recipe"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("api_key", "model_name"),
    [(None, "model"), ("key", None), ("", "model"), ("key", "")],
)
async def test_missing_configuration_returns_friendly_502_without_creating_model(
    monkeypatch: pytest.MonkeyPatch,
    api_key: str | None,
    model_name: str | None,
) -> None:
    if api_key is None:
        monkeypatch.delenv("AI_API_KEY", raising=False)
    else:
        monkeypatch.setenv("AI_API_KEY", api_key)
    if model_name is None:
        monkeypatch.delenv("AI_MODEL", raising=False)
    else:
        monkeypatch.setenv("AI_MODEL", model_name)
    monkeypatch.setattr(ai, "_create_model", lambda *_: pytest.fail("model should not be created"))

    response = await ai.create_adaptation_response({}, {})

    assert isinstance(response, JSONResponse)
    assert response.status_code == 502
    assert response_text(response) == '{"error":"The AI service is not configured."}'


@pytest.mark.asyncio
async def test_provider_failure_before_first_text_returns_friendly_502(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AI_API_KEY", "key")
    monkeypatch.setenv("AI_MODEL", "model")

    class FailingChunks:
        closed = False

        def __aiter__(self) -> FailingChunks:
            return self

        async def __anext__(self) -> Any:
            raise RuntimeError("private provider endpoint and token")

        async def aclose(self) -> None:
            self.closed = True

    chunks = FailingChunks()

    class FailingModel:
        def astream(self, _messages: list[Any]) -> AsyncIterator[Any]:
            return chunks

    monkeypatch.setattr(ai, "_create_model", lambda *_: FailingModel())

    response = await ai.create_adaptation_response({}, {})

    assert isinstance(response, JSONResponse)
    assert response.status_code == 502
    assert "private provider endpoint" not in response_text(response)
    assert "unavailable" in response_text(response)
    assert chunks.closed


@pytest.mark.asyncio
async def test_empty_provider_stream_returns_friendly_502(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_API_KEY", "key")
    monkeypatch.setenv("AI_MODEL", "model")
    chunks = TrackedChunks([text_chunk(""), text_chunk(""), text_chunk(None)])
    monkeypatch.setattr(ai, "_create_model", lambda *_: FakeModel(chunks))

    response = await ai.create_adaptation_response({}, {})

    assert isinstance(response, JSONResponse)
    assert response.status_code == 502
    assert "unavailable" in response_text(response)
    assert chunks.closed


@pytest.mark.asyncio
async def test_midstream_failure_hides_provider_error_and_closes_iterator(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AI_API_KEY", "key")
    monkeypatch.setenv("AI_MODEL", "model")

    async def failing_chunks() -> AsyncGenerator[Any]:
        yield text_chunk("Partial recipe")
        raise RuntimeError("secret provider response body")

    class ClosableFailingChunks:
        def __init__(self) -> None:
            self.iterator: AsyncGenerator[Any] = failing_chunks()
            self.closed = False

        def __aiter__(self) -> ClosableFailingChunks:
            return self

        async def __anext__(self) -> Any:
            return await anext(self.iterator)

        async def aclose(self) -> None:
            self.closed = True
            await self.iterator.aclose()

    chunks = ClosableFailingChunks()
    monkeypatch.setattr(ai, "_create_model", lambda *_: FakeModel(chunks))

    response = await ai.create_adaptation_response({}, {})

    assert isinstance(response, StreamingResponse)
    stream = aiter(response.body_iterator)
    assert await anext(stream) == "Partial recipe"
    with pytest.raises(RuntimeError, match=ai.INTERRUPTED_MESSAGE) as error:
        await anext(stream)
    assert "secret provider response body" not in str(error.value)
    assert chunks.closed


@pytest.mark.asyncio
async def test_stream_cancellation_closes_model_iterator(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_API_KEY", "key")
    monkeypatch.setenv("AI_MODEL", "model")
    waiting = asyncio.Event()

    class WaitingChunks:
        def __init__(self) -> None:
            self.first = True
            self.closed = False

        def __aiter__(self) -> WaitingChunks:
            return self

        async def __anext__(self) -> Any:
            if self.first:
                self.first = False
                return text_chunk("First text")
            waiting.set()
            await asyncio.Future()

        async def aclose(self) -> None:
            self.closed = True

    chunks = WaitingChunks()
    monkeypatch.setattr(ai, "_create_model", lambda *_: FakeModel(chunks))

    response = await ai.create_adaptation_response({}, {})
    assert isinstance(response, StreamingResponse)

    async def consume() -> None:
        async for _part in response.body_iterator:
            pass

    task = asyncio.create_task(consume())
    await asyncio.wait_for(waiting.wait(), timeout=1)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task

    assert chunks.closed
