from __future__ import annotations

import json
import os
import socket
import subprocess
import time
from pathlib import Path
from typing import Any

import httpx
import psycopg
from psycopg import sql

ROOT = Path(__file__).resolve().parents[2]
AI_KEY = "integrated-test-key"
AI_MODEL = "integrated-test-model"


def free_port() -> int:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return int(listener.getsockname()[1])


def wait_for_server(url: str, process: subprocess.Popen[bytes], log_path: Path) -> None:
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if process.poll() is not None:
            break
        try:
            response = httpx.get(url, timeout=0.5)
            if response.status_code < 500:
                return
        except httpx.HTTPError:
            time.sleep(0.1)
    log = log_path.read_text(encoding="utf-8", errors="replace") if log_path.exists() else ""
    raise AssertionError(f"Server did not become ready: {url}\n{log}")


def launch(
    command: list[str], environment: dict[str, str], log_path: Path
) -> subprocess.Popen[bytes]:
    log = log_path.open("wb")
    try:
        process = subprocess.Popen(
            command,
            cwd=ROOT,
            env=environment,
            stdout=log,
            stderr=subprocess.STDOUT,
        )
    finally:
        log.close()
    return process


def stop(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=10)


def post_form(
    client: httpx.Client, origin: str, path: str, data: dict[str, str]
) -> httpx.Response:
    return client.post(
        path,
        data=data,
        headers={"accept": "text/html", "origin": origin},
    )


def child_environment(
    host: str,
    port: int,
    database: str,
    frontend_origin: str,
    backend_origin: str,
    mode_path: Path,
    events_path: Path,
) -> dict[str, str]:
    environment = os.environ.copy()
    environment.update(
        {
            "PGHOST": host,
            "PGUSER": "postgres",
            "PGDATABASE": database,
            "PGPASSWORD": "",
            "PGPORT": str(port),
            "PGSSLMODE": "disable",
            "AI_API_KEY": AI_KEY,
            "AI_MODEL": AI_MODEL,
            "APP_ORIGIN": frontend_origin,
            "BACKEND_URL": backend_origin,
            "DEARDISH_TEST_AI_MODE": str(mode_path),
            "DEARDISH_TEST_AI_EVENTS": str(events_path),
            "PYTHONPATH": str(ROOT),
        }
    )
    return environment


def node_legacy_credentials() -> tuple[str, str, str]:
    password = "legacy-passphrase"
    salt = "00112233445566778899aabbccddeeff"
    token = "existing-node-session-token"
    script = (
        "const crypto = require('node:crypto');"
        f"const salt = '{salt}'; const password = '{password}'; const token = '{token}';"
        "const digest = crypto.scryptSync(password, salt, 64).toString('hex');"
        "const tokenHash = crypto.createHash('sha256').update(token).digest('hex');"
        "process.stdout.write(JSON.stringify({passwordHash: salt + ':' + digest, tokenHash}));"
    )
    result = subprocess.run(
        ["node", "-e", script], check=True, capture_output=True, text=True
    )
    values = json.loads(result.stdout)
    return password, str(values["passwordHash"]), str(values["tokenHash"])


def table_counts(connection: psycopg.Connection[Any]) -> dict[str, int]:
    tables = ("images", "users", "sessions", "health_profiles", "dishes", "meals")
    counts: dict[str, int] = {}
    for table in tables:
        row = connection.execute(
            sql.SQL("SELECT count(*) FROM public.{}").format(sql.Identifier(table))
        ).fetchone()
        assert row is not None
        counts[table] = int(row[0])
    return counts
