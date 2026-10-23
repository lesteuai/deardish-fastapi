from __future__ import annotations

import os
import socket
import subprocess
from collections.abc import AsyncIterator, Iterator
from pathlib import Path
from uuid import uuid4

import psycopg
import pytest
import pytest_asyncio
from psycopg import sql


@pytest.fixture(scope="session")
def postgres_server(tmp_path_factory: pytest.TempPathFactory) -> Iterator[tuple[str, int]]:
    binary_dir = os.environ.get("DEARDISH_TEST_POSTGRES_BIN")
    if not binary_dir:
        pytest.fail(
            "Set DEARDISH_TEST_POSTGRES_BIN to the bin directory from the isolated "
            "@embedded-postgres/linux-x64 package."
        )
    binaries = Path(binary_dir).resolve()
    initdb = binaries / "initdb"
    pg_ctl = binaries / "pg_ctl"
    if not initdb.is_file() or not pg_ctl.is_file():
        pytest.fail(f"PostgreSQL initdb and pg_ctl binaries were not found in {binaries}.")

    data_dir = tmp_path_factory.mktemp("deardish-postgres") / "data"
    subprocess.run(
        [str(initdb), "-D", str(data_dir), "--username=postgres", "--auth=trust"],
        check=True,
        capture_output=True,
        text=True,
    )
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]

    subprocess.run(
        [
            str(pg_ctl),
            "-D",
            str(data_dir),
            "-l",
            str(data_dir.parent / "postgres.log"),
            "-o",
            f"-h 127.0.0.1 -p {port} -F",
            "-w",
            "start",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    try:
        yield "127.0.0.1", port
    finally:
        subprocess.run(
            [str(pg_ctl), "-D", str(data_dir), "-m", "fast", "-w", "stop"],
            check=True,
            capture_output=True,
            text=True,
        )


@pytest_asyncio.fixture
async def test_database(
    postgres_server: tuple[str, int], monkeypatch: pytest.MonkeyPatch
) -> AsyncIterator[tuple[str, int, str]]:
    host, port = postgres_server
    database_name = f"deardish_test_{uuid4().hex}"
    with psycopg.connect(
        host=host, port=port, user="postgres", dbname="postgres", autocommit=True
    ) as connection:
        connection.execute(
            sql.SQL("CREATE DATABASE {} OWNER postgres").format(sql.Identifier(database_name))
        )

    for name in ("PGHOST", "PGUSER", "PGDATABASE", "PGPASSWORD", "PGPORT", "PGSSLMODE"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("PGHOST", host)
    monkeypatch.setenv("PGUSER", "postgres")
    monkeypatch.setenv("PGDATABASE", database_name)
    monkeypatch.setenv("PGPASSWORD", "")
    monkeypatch.setenv("PGPORT", str(port))
    monkeypatch.setenv("PGSSLMODE", "disable")

    from backend import db, manage

    await db.close_db()
    await manage.setup_schema()
    try:
        yield host, port, database_name
    finally:
        await db.close_db()
        monkeypatch.undo()
        admin_connection = psycopg.connect(
            host=host, port=port, user="postgres", dbname="postgres", autocommit=True
        )
        with admin_connection as connection:
            connection.execute(
                sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(database_name))
            )
