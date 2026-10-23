"""Lazy Embar database access backed by a bounded Psycopg async pool."""

from __future__ import annotations

import os

from embar.db.pg import AsyncPgDb
from psycopg.conninfo import make_conninfo
from psycopg_pool import AsyncConnectionPool

_pool: AsyncConnectionPool | None = None
_db: AsyncPgDb | None = None


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
    """Return the process Embar client, opening its pool only on first use."""
    global _pool, _db
    if _db is None:
        _pool = AsyncConnectionPool(
            conninfo=build_conninfo,
            min_size=0,
            max_size=10,
            timeout=10,
            open=False,
            kwargs={"prepare_threshold": None},
        )
        _db = AsyncPgDb(_pool)
    pool = _pool
    if pool is None:
        raise RuntimeError("Database pool could not be initialized.")
    await pool.open()
    return _db


async def close_db() -> None:
    """Close the process pool and reset the lazy client."""
    global _pool, _db
    if _pool is not None:
        await _pool.close()
    _pool = None
    _db = None
