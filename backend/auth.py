"""Authentication and compatible persistent session operations."""

from __future__ import annotations

import hashlib
import hmac
import re
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from embar.query.query import QuerySingle
from psycopg.errors import UniqueViolation

from .db import fetch_models, get_db
from .models import AuthUser, UserCredentials

SESSION_COOKIE = "deardish_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 7
_SCRYPT_N = 16384
_SCRYPT_R = 8
_SCRYPT_P = 1
_SCRYPT_DKLEN = 64
_PASSWORD_HASH_PATTERN = re.compile(r"^[0-9a-fA-F]{32}:[0-9a-fA-F]{128}$")


def _password_digest(password: str, salt: str) -> bytes:
    return hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt.encode("utf-8"),
        n=_SCRYPT_N,
        r=_SCRYPT_R,
        p=_SCRYPT_P,
        dklen=_SCRYPT_DKLEN,
    )


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16).hex()
    return f"{salt}:{_password_digest(password, salt).hex()}"


def verify_password(password: str, stored: str) -> bool:
    if not isinstance(stored, str) or not _PASSWORD_HASH_PATTERN.fullmatch(stored):
        return False
    salt, expected_hash = stored.split(":", 1)
    try:
        actual_hash = _password_digest(password, salt)
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual_hash, bytes.fromhex(expected_hash))


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def register_user(email: str, password: str) -> AuthUser | None:
    normalized_email = email.strip().lower()
    db = await get_db()
    existing = await fetch_models(
        db,
        "SELECT id, email FROM users WHERE lower(email) = %(email)s LIMIT 1",
        {"email": normalized_email},
        AuthUser,
    )
    if existing:
        return None

    try:
        created = await fetch_models(
        db,
        """INSERT INTO users (email, password_hash)
            VALUES (%(email)s, %(password_hash)s)
            RETURNING id, email""",
            {"email": normalized_email, "password_hash": hash_password(password)},
            AuthUser,
        )
    except UniqueViolation:
        return None
    return created[0] if created else None


async def authenticate(email: str, password: str) -> AuthUser | None:
    normalized_email = email.strip().lower()
    db = await get_db()
    users = await fetch_models(
        db,
        """SELECT id, email, password_hash, created_at
            FROM users WHERE lower(email) = %(email)s LIMIT 1""",
        {"email": normalized_email},
        UserCredentials,
    )
    if not users or not verify_password(password, users[0].password_hash):
        return None
    return AuthUser(id=users[0].id, email=users[0].email)


async def create_session(user_id: UUID | str) -> str:
    token = secrets.token_urlsafe(32)
    token_hash = hash_token(token)
    expires_at = datetime.now(UTC) + timedelta(seconds=SESSION_MAX_AGE)
    db = await get_db()
    await db.execute(
        QuerySingle(
            """INSERT INTO sessions (token_hash, user_id, expires_at)
                VALUES (%(token_hash)s, %(user_id)s, %(expires_at)s)""",
            {"token_hash": token_hash, "user_id": user_id, "expires_at": expires_at},
        )
    )
    return token


async def validate_session(token: str | None) -> AuthUser | None:
    if not token:
        return None
    token_hash = hash_token(token)
    now = datetime.now(UTC)
    db = await get_db()
    users = await fetch_models(
        db,
        """SELECT u.id, u.email
            FROM sessions AS s JOIN users AS u ON u.id = s.user_id
            WHERE s.token_hash = %(token_hash)s AND s.expires_at > %(now)s
            LIMIT 1""",
        {"token_hash": token_hash, "now": now},
        AuthUser,
    )
    return users[0] if users else None


async def destroy_session(token: str) -> None:
    token_hash = hash_token(token)
    db = await get_db()
    await db.execute(
        QuerySingle(
            "DELETE FROM sessions WHERE token_hash = %(token_hash)s",
            {"token_hash": token_hash},
        )
    )
