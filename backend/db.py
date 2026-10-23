"""Lazy Embar database access backed by a bounded Psycopg async pool."""

from __future__ import annotations

import os

from embar.db.pg import AsyncPgDb
from embar.query.query import QuerySingle
from psycopg.conninfo import make_conninfo
from psycopg_pool import AsyncConnectionPool
from pydantic import BaseModel

_pool: AsyncConnectionPool | None = None


async def fetch_models[RowModel: BaseModel](
    db: AsyncPgDb,
    sql: str,
    params: dict[str, object],
    model: type[RowModel],
) -> list[RowModel]:
    """Fetch parameterized rows and validate them against their database model."""
    rows = await db.fetch(QuerySingle(sql, params))
    return [model.model_validate(row) for row in rows]


def build_conninfo(environ: dict[str, str] | None = None) -> str:
    """Build safely escaped PostgreSQL conninfo from configured environment values."""
    values = os.environ if environ is None else environ
    required = ("PGHOST", "PGUSER", "PGDATABASE")
    missing = [name for name in required if not values.get(name)]
    if missing:
        raise RuntimeError(f"Missing required database configuration: {', '.join(missing)}")

    options: dict[str, str | int] = {
        "host": values["PGHOST"],
        "user": values["PGUSER"],
        "dbname": values["PGDATABASE"],
        "password": values.get("PGPASSWORD", ""),
        "sslmode": values.get("PGSSLMODE", "require"),
        "connect_timeout": 10,
    }
    if values.get("PGPORT"):
        options["port"] = int(values["PGPORT"])
    return make_conninfo("", **options)


async def get_db() -> AsyncPgDb:
    """Return a fresh Embar client backed by the process pool."""
    global _pool
    if _pool is None:
        _pool = AsyncConnectionPool(
            conninfo=build_conninfo,
            min_size=0,
            max_size=10,
            timeout=10,
            open=False,
            kwargs={"prepare_threshold": None},
        )
    pool = _pool
    await pool.open()
    return AsyncPgDb(pool)


async def close_db() -> None:
    """Close the process pool and reset lazy database access."""
    global _pool
    if _pool is not None:
        await _pool.close()
    _pool = None
