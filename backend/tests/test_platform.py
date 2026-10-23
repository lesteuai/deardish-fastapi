from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from typing import cast
from uuid import UUID

import pytest
from backend import db, models


def test_build_conninfo_uses_defaults_and_escapes_values() -> None:
    conninfo = db.build_conninfo(
        {
            "PGHOST": "db host",
            "PGUSER": "user'name",
            "PGDATABASE": "dish db",
            "PGPASSWORD": "a 'quoted' \\ password",
        }
    )

    assert "host='db host'" in conninfo
    assert "user=user\\'name" in conninfo
    assert "dbname='dish db'" in conninfo
    assert r"password='a \'quoted\' \\ password'" in conninfo
    assert "sslmode=require" in conninfo
    assert "connect_timeout=10" in conninfo


def test_build_conninfo_requires_database_keys() -> None:
    with pytest.raises(RuntimeError, match="PGHOST, PGUSER, PGDATABASE"):
        db.build_conninfo({})


def test_build_conninfo_accepts_optional_port_and_sslmode() -> None:
    conninfo = db.build_conninfo(
        {
            "PGHOST": "localhost",
            "PGUSER": "deardish",
            "PGDATABASE": "deardish_test",
            "PGPORT": "55432",
            "PGSSLMODE": "disable",
        }
    )

    assert "port=55432" in conninfo
    assert "sslmode=disable" in conninfo


def test_import_is_lazy_and_pool_lifecycle_is_bounded(monkeypatch: pytest.MonkeyPatch) -> None:
    created: list[dict[str, object]] = []

    class FakePool:
        def __init__(self, **kwargs: object) -> None:
            self.kwargs = kwargs
            self.open_count = 0
            self.close_count = 0
            created.append(kwargs)

        async def open(self) -> None:
            self.open_count += 1

        async def close(self) -> None:
            self.close_count += 1

    class FakeEmbarDb:
        def __init__(self, pool: FakePool) -> None:
            self.pool = pool

    async def exercise() -> None:
        await db.close_db()
        monkeypatch.setattr(db, "AsyncConnectionPool", FakePool)
        monkeypatch.setattr(db, "AsyncPgDb", FakeEmbarDb)
        first = cast(FakeEmbarDb, await db.get_db())
        second = await db.get_db()

        assert first is second
        assert len(created) == 1
        assert created[0]["min_size"] == 0
        assert created[0]["max_size"] == 10
        assert created[0]["open"] is False
        assert created[0]["kwargs"] == {"prepare_threshold": None}
        pool = cast(FakePool, db._pool)
        assert pool.open_count == 2

        await db.close_db()
        assert pool.close_count == 1
        assert db._pool is None
        assert db._db is None

    asyncio.run(exercise())


def test_models_accept_legacy_aliases_and_postgres_values() -> None:
    user_id = UUID("9f389a12-7642-4604-85cf-0bd1fb14c241")
    stamp = datetime(2026, 10, 23, 12, 30, tzinfo=UTC)

    profile = models.HealthProfile.model_validate(
        {
            "user_id": user_id,
            "conditions": None,
            "allergies": "peanuts",
            "dietary_preferences": "vegetarian",
            "notes": None,
            "updated_at": stamp,
        }
    )
    dish = models.Dish.model_validate(
        {
            "id": user_id,
            "name": "Example",
            "cuisine": "Test",
            "description": "Dish",
            "content": "Original recipe",
            "last_updated": stamp,
            "ingredients": ["beans", "rice"],
            "image_id": None,
        }
    )

    assert profile.user_id == user_id
    assert profile.dietary_preferences == "vegetarian"
    assert profile.updated_at.tzinfo is UTC
    assert dish.id == user_id
    assert dish.ingredients == ["beans", "rice"]
    assert dish.image_id is None
    assert json.loads(dish.model_dump_json(by_alias=True))["lastUpdated"].startswith(
        "2026-10-23T12:30:00"
    )
