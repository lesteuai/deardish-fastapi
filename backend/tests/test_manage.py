from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any
from uuid import NAMESPACE_URL, UUID, uuid5

import pytest
from backend import manage


class FakeCursor:
    def __init__(self, rows: list[tuple[Any, ...]] | None = None) -> None:
        self.rows = rows or []

    async def fetchone(self) -> tuple[Any, ...] | None:
        return self.rows[0] if self.rows else None

    async def fetchall(self) -> list[tuple[Any, ...]]:
        return self.rows


class FakeConnection:
    def __init__(
        self,
        *,
        ledger_exists: bool = True,
        existing_tables: list[str] | None = None,
        applied: list[str] | None = None,
        existing_seed_ids: set[str] | None = None,
    ) -> None:
        self.ledger_exists = ledger_exists
        self.existing_tables = existing_tables or []
        self.applied = applied or []
        self.existing_seed_ids = existing_seed_ids or set()
        self.statements: list[tuple[str, tuple[Any, ...] | None]] = []
        self.transaction_rolled_back = False
        self._in_transaction = False

    async def __aenter__(self) -> FakeConnection:
        return self

    async def __aexit__(self, exc_type: object, exc: object, tb: object) -> bool:
        return False

    def transaction(self) -> FakeConnection:
        return self

    async def enter_transaction(self) -> None:
        self._in_transaction = True

    async def exit_transaction(
        self, exc_type: object, exc: object, tb: object
    ) -> bool:
        self._in_transaction = False
        self.transaction_rolled_back = exc_type is not None
        return False

    async def execute(
        self, query: Any, params: tuple[Any, ...] | None = None
    ) -> FakeCursor:
        sql = query.as_string() if hasattr(query, "as_string") else str(query)
        self.statements.append((sql, params))
        if "to_regclass" in sql:
            return FakeCursor([(self.ledger_exists,)])
        if "information_schema.tables" in sql:
            return FakeCursor([(name,) for name in self.existing_tables])
        if "SELECT migration_id" in sql:
            return FakeCursor([(name,) for name in self.applied])
        if "SELECT id FROM public.dishes" in sql:
            assert params is not None
            dish_name, dish_id = params
            existing = dish_id in self.existing_seed_ids or dish_name in self.existing_seed_ids
            return FakeCursor([(dish_id,)] if existing else [])
        return FakeCursor()


class FakeTransaction:
    def __init__(self, connection: FakeConnection) -> None:
        self.connection = connection

    async def __aenter__(self) -> None:
        await self.connection.enter_transaction()

    async def __aexit__(self, exc_type: object, exc: object, tb: object) -> bool:
        return await self.connection.exit_transaction(exc_type, exc, tb)


def connect_with(monkeypatch: pytest.MonkeyPatch, connection: FakeConnection) -> None:
    class FakeAsyncConnection:
        @staticmethod
        async def connect(conninfo: str) -> FakeConnection:
            assert conninfo == "isolated-test-db"
            return connection

    monkeypatch.setattr(manage, "AsyncConnection", FakeAsyncConnection)
    monkeypatch.setattr(manage, "database_conninfo", lambda: "isolated-test-db")
    monkeypatch.setattr(FakeConnection, "transaction", lambda self: FakeTransaction(self))


def test_setup_applies_migrations_in_order_and_records_ledger(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    migrations = tmp_path / "drizzle"
    migrations.mkdir()
    (migrations / "0002_second.sql").write_text("SELECT 2;", encoding="utf-8")
    (migrations / "0001_first.sql").write_text(
        "SELECT 1;\n--> statement-breakpoint\nSELECT 11;", encoding="utf-8"
    )
    monkeypatch.setattr(manage, "MIGRATIONS", migrations)
    connection = FakeConnection(ledger_exists=False)
    connect_with(monkeypatch, connection)

    asyncio.run(manage.setup_schema())

    executed = [query for query, _ in connection.statements]
    migration_sql = [
        query for query in executed if query in {"SELECT 1;", "SELECT 11;", "SELECT 2;"}
    ]
    assert migration_sql == ["SELECT 1;", "SELECT 11;", "SELECT 2;"]
    recorded = [
        params[0]
        for query, params in connection.statements
        if "INSERT INTO public.deardish_schema_migrations" in query and params
    ]
    assert recorded == ["0001_first.sql", "0002_second.sql"]


def test_setup_refuses_unmanaged_existing_application_tables(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    connection = FakeConnection(ledger_exists=False, existing_tables=["users", "dishes"])
    connect_with(monkeypatch, connection)

    with pytest.raises(RuntimeError, match="existing application tables have no setup ledger"):
        asyncio.run(manage.setup_schema())

    assert connection.transaction_rolled_back
    assert not any(
        "CREATE TABLE IF NOT EXISTS public.deardish_schema_migrations" in query
        for query, _ in connection.statements
    )


def test_setup_skips_migrations_already_in_ledger(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    migrations = tmp_path / "drizzle"
    migrations.mkdir()
    (migrations / "0001_first.sql").write_text("SELECT 1;", encoding="utf-8")
    monkeypatch.setattr(manage, "MIGRATIONS", migrations)
    connection = FakeConnection(applied=["0001_first.sql"])
    connect_with(monkeypatch, connection)

    asyncio.run(manage.setup_schema())

    assert not any(query == "SELECT 1;" for query, _ in connection.statements)
    assert not any(
        "INSERT INTO public.deardish_schema_migrations" in query
        for query, _ in connection.statements
    )


def test_seed_uses_stable_ids_and_preserves_existing_named_dishes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seed = {
        "images": [
            {"id": "10000000-0000-4000-8000-000000000001", "location": "/image.jpg", "type": "file"}
        ],
        "dishes": [
            {
                "name": "Legacy Dish",
                "cuisine": "Test",
                "description": "Existing record",
                "content": "Keep as is",
                "ingredients": ["rice"],
                "imageId": "10000000-0000-4000-8000-000000000001",
            },
            {
                "name": "New Dish",
                "cuisine": "Test",
                "description": "New record",
                "content": "Recipe",
                "ingredients": ["beans"],
                "imageId": "10000000-0000-4000-8000-000000000001",
            },
        ],
    }
    monkeypatch.setattr(manage, "load_seed", lambda: seed)
    # A legacy dish with an arbitrary id is found by name, so it remains unchanged.
    connection = FakeConnection(existing_seed_ids={"Legacy Dish"})
    connect_with(monkeypatch, connection)

    asyncio.run(manage.seed_catalog())
    first_insert = next(
        params
        for query, params in connection.statements
        if "INSERT INTO public.dishes" in query and params is not None
    )
    stable_id = first_insert[0]
    assert UUID(stable_id).version == 5
    assert stable_id == str(
        uuid5(uuid5(NAMESPACE_URL, "https://deardish.app/catalog/v1"), "New Dish")
    )
    assert first_insert[1] == "New Dish"
    assert sum("INSERT INTO public.dishes" in query for query, _ in connection.statements) == 1
    assert any(
        "ON CONFLICT DO NOTHING" in query
        for query, _ in connection.statements
        if "INSERT INTO public.images" in query
    )

    connection.statements.clear()
    connection.existing_seed_ids.add("New Dish")
    asyncio.run(manage.seed_catalog())

    assert not any("INSERT INTO public.dishes" in query for query, _ in connection.statements)
