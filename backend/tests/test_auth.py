from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import psycopg
import pytest
from backend import auth

NODE_PASSWORD_HASH = (
    "0123456789abcdef0123456789abcdef:"
    "e821bb0eb26d858c52d0a7292769b016fd1024c8c71b654e6e647c49b725cc49"
    "f043d41bb38af41384ac89496594683c79ddfc6a94549dea3cd484a89f69b114"
)
NODE_TOKEN = "node-generated-legacy-session-token"
NODE_TOKEN_HASH = "e9ad83753459f99ba1306297c28e0e9d1d100d232fd9bcfc251eeeede706f0d7"


async def insert_user(
    test_database: tuple[str, int, str], email: str, password_hash: str
) -> str:
    host, port, database = test_database
    user_id = uuid4()
    with psycopg.connect(host=host, port=port, user="postgres", dbname=database) as connection:
        connection.execute(
            "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
            (user_id, email, password_hash),
        )
    return str(user_id)


@pytest.mark.asyncio
async def test_node_scrypt_and_session_digest_remain_compatible(test_database) -> None:
    assert auth.verify_password("legacy-passphrase", NODE_PASSWORD_HASH)
    user_id = await insert_user(test_database, "Legacy.User@example.com", NODE_PASSWORD_HASH)
    host, port, database = test_database
    with psycopg.connect(host=host, port=port, user="postgres", dbname=database) as connection:
        connection.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (%s, %s, %s)",
            (NODE_TOKEN_HASH, user_id, datetime.now(UTC) + timedelta(days=1)),
        )

    user = await auth.authenticate("  LEGACY.USER@EXAMPLE.COM ", "legacy-passphrase")
    session_user = await auth.validate_session(NODE_TOKEN)

    assert user is not None and str(user.id) == user_id
    assert session_user == user
    await auth.destroy_session(NODE_TOKEN)
    assert await auth.validate_session(NODE_TOKEN) is None


@pytest.mark.asyncio
async def test_malformed_password_hashes_and_expired_sessions_are_rejected(test_database) -> None:
    malformed_hashes = ["", "not-a-hash", "z" * 32 + ":" + "0" * 128, "0" * 32 + ":bad"]
    for index, password_hash in enumerate(malformed_hashes):
        assert not auth.verify_password("anything", password_hash)
        await insert_user(test_database, f"malformed-{index}@example.com", password_hash)
        assert await auth.authenticate(f"malformed-{index}@example.com", "anything") is None

    user_id = await insert_user(test_database, "expired@example.com", NODE_PASSWORD_HASH)
    expired_token = "node-generated-expired-session-token"
    expired_hash = auth.hash_token(expired_token)
    host, port, database = test_database
    with psycopg.connect(host=host, port=port, user="postgres", dbname=database) as connection:
        connection.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (%s, %s, %s)",
            (expired_hash, user_id, datetime.now(UTC) - timedelta(seconds=1)),
        )

    assert await auth.validate_session(expired_token) is None
    assert await auth.validate_session(None) is None


@pytest.mark.asyncio
async def test_new_sessions_store_only_a_seven_day_token_digest(test_database) -> None:
    user_id = await insert_user(test_database, "new-session@example.com", NODE_PASSWORD_HASH)

    token = await auth.create_session(user_id)
    host, port, database = test_database
    with psycopg.connect(host=host, port=port, user="postgres", dbname=database) as connection:
        row = connection.execute(
            "SELECT token_hash, expires_at FROM sessions WHERE user_id = %s", (user_id,)
        ).fetchone()

    assert row is not None
    assert row[0] == auth.hash_token(token)
    assert row[0] != token
    remaining = row[1] - datetime.now(UTC)
    assert timedelta(days=7, seconds=-5) < remaining <= timedelta(days=7)


@pytest.mark.asyncio
async def test_case_insensitive_duplicate_registration_race_creates_one_user(test_database) -> None:
    results = await asyncio.gather(
        auth.register_user("Race.User@example.com", "long-enough-password"),
        auth.register_user(" race.user@EXAMPLE.com ", "long-enough-password"),
    )
    host, port, database = test_database
    with psycopg.connect(host=host, port=port, user="postgres", dbname=database) as connection:
        rows = connection.execute(
            "SELECT email FROM users WHERE lower(email) = %s", ("race.user@example.com",)
        ).fetchall()

    assert sum(result is not None for result in results) == 1
    assert len(rows) == 1
    assert rows[0][0] == "race.user@example.com"
