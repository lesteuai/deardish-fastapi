from __future__ import annotations

import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from uuid import UUID, uuid4

import psycopg
import pytest
from backend import ai, auth, db
from backend.main import app
from backend.tests.conftest import clear_service_environment
from backend.tests.test_repository import insert_dish, insert_user
from fastapi.testclient import TestClient


@pytest.fixture
def client(test_database):
    with TestClient(app) as test_client:
        yield test_client
        assert test_client.portal is not None
        test_client.portal.call(db.close_db)


def register(client: TestClient, email: str = "api-user@example.com") -> dict[str, str]:
    response = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "long-enough-password",
            "confirmPassword": "long-enough-password",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["user"]


def test_service_environment_guard_clears_inherited_configuration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service_variables = (
        "PGHOST",
        "PGUSER",
        "PGDATABASE",
        "PGPASSWORD",
        "PGPORT",
        "PGSSLMODE",
        "AI_API_KEY",
        "AI_MODEL",
    )
    for name in service_variables:
        monkeypatch.setenv(name, "test-only-sentinel")

    clear_service_environment(monkeypatch)

    assert all(name not in os.environ for name in service_variables)


def test_isolated_database_overrides_postgres_and_clears_ai_settings(test_database) -> None:
    host, port, database_name = test_database

    assert os.environ["PGHOST"] == host
    assert os.environ["PGUSER"] == "postgres"
    assert os.environ["PGDATABASE"] == database_name
    assert os.environ["PGPASSWORD"] == ""
    assert os.environ["PGPORT"] == str(port)
    assert os.environ["PGSSLMODE"] == "disable"
    assert "AI_API_KEY" not in os.environ
    assert "AI_MODEL" not in os.environ


def test_health_and_session_shapes(client: TestClient, test_database) -> None:
    assert client.get("/api/health").json() == {"status": "ok"}
    assert client.get("/api/auth/session").json() == {"user": None}

    user = register(client)

    assert client.get("/api/auth/session").json() == {"user": user}


def test_registration_validation_duplicate_and_https_cookie(
    client: TestClient, test_database
) -> None:
    host, port, database = test_database
    malformed_cases = [
        (
            {
                "email": "not-an-email",
                "password": "long-enough-password",
                "confirmPassword": "long-enough-password",
            },
            "email",
        ),
        (
            {"email": "short@example.com", "password": "short", "confirmPassword": "short"},
            "password",
        ),
        (
            {
                "email": "mismatch@example.com",
                "password": "long-enough-password",
                "confirmPassword": "different-password",
            },
            "confirmPassword",
        ),
        (
            {
                "email": "extra@example.com",
                "password": "long-enough-password",
                "confirmPassword": "long-enough-password",
                "extra": True,
            },
            "extra",
        ),
    ]
    for body, field in malformed_cases:
        response = client.post("/api/auth/register", json=body)
        assert response.status_code == 400
        assert field in response.json()["errors"]
    with psycopg.connect(host=host, port=port, user="postgres", dbname=database) as connection:
        invalid_accounts = connection.execute(
            "SELECT count(*) FROM users WHERE email = 'api-user@example.com'"
        ).fetchone()
    assert invalid_accounts is not None and invalid_accounts[0] == 0

    with TestClient(app, base_url="https://testserver") as https_client:
        response = https_client.post(
            "/api/auth/register",
            json={
                "email": "  API-USER@EXAMPLE.COM ",
                "password": "long-enough-password",
                "confirmPassword": "long-enough-password",
            },
        )

    assert response.status_code == 201
    assert response.json()["user"]["email"] == "api-user@example.com"
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "path=/" in cookie
    assert "secure" in cookie
    assert f"max-age={auth.SESSION_MAX_AGE}" in cookie

    duplicate = client.post(
        "/api/auth/register",
        json={
            "email": "API-USER@example.com",
            "password": "long-enough-password",
            "confirmPassword": "long-enough-password",
        },
    )
    assert duplicate.status_code == 400
    assert "email" in duplicate.json()["errors"]


def test_registration_duplicate_race_returns_one_success_and_one_field_error(test_database) -> None:
    payload = {
        "email": "api-race@example.com",
        "password": "long-enough-password",
        "confirmPassword": "long-enough-password",
    }

    def submit() -> int:
        with TestClient(app) as race_client:
            return race_client.post("/api/auth/register", json=payload).status_code

    with ThreadPoolExecutor(max_workers=2) as executor:
        statuses = list(executor.map(lambda _: submit(), range(2)))

    assert sorted(statuses) == [201, 400]
    host, port, database = test_database
    with psycopg.connect(host=host, port=port, user="postgres", dbname=database) as connection:
        row = connection.execute(
            "SELECT count(*) FROM users WHERE email = %s", (payload["email"],)
        ).fetchone()
    assert row is not None and row[0] == 1


def test_login_logout_and_invalid_session_cookie(client: TestClient, test_database) -> None:
    user = register(client, "login@example.com")
    login = client.post(
        "/api/auth/login", json={"email": " LOGIN@EXAMPLE.COM ", "password": "long-enough-password"}
    )
    assert login.status_code == 200
    assert login.json() == {"user": user}
    login_cookie = login.headers["set-cookie"].lower()
    assert "httponly" in login_cookie and "samesite=lax" in login_cookie
    assert "path=/" in login_cookie and f"max-age={auth.SESSION_MAX_AGE}" in login_cookie
    assert "secure" not in login_cookie

    bad_login = client.post(
        "/api/auth/login", json={"email": "login@example.com", "password": "incorrect"}
    )
    assert bad_login.status_code == 401
    host, port, database = test_database
    with psycopg.connect(host=host, port=port, user="postgres", dbname=database) as connection:
        sessions = connection.execute(
            "SELECT count(*) FROM sessions WHERE user_id = %s", (user["id"],)
        ).fetchone()
    assert sessions is not None and sessions[0] == 2

    client.cookies.clear()
    client.cookies.set(auth.SESSION_COOKIE, "invalid-token")
    assert client.get("/api/profile").status_code == 401

    client.cookies.clear()
    client.cookies.set(auth.SESSION_COOKIE, "expired-token")
    user_id = user["id"]
    with psycopg.connect(host=host, port=port, user="postgres", dbname=database) as connection:
        connection.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (%s, %s, %s)",
            (auth.hash_token("expired-token"), user_id, datetime.now(UTC) - timedelta(seconds=1)),
        )
    assert client.get("/api/profile").status_code == 401

    client.cookies.clear()
    client.cookies.set(auth.SESSION_COOKIE, login.cookies[auth.SESSION_COOKIE])
    logout = client.post("/api/auth/logout")
    assert logout.status_code == 204
    assert client.get("/api/auth/session").json() == {"user": None}
    cleared_cookie = logout.headers["set-cookie"].lower()
    assert "max-age=0" in cleared_cookie
    assert "httponly" in cleared_cookie and "samesite=lax" in cleared_cookie
    assert "path=/" in cleared_cookie


def test_protected_routes_authenticate_before_body_validation(client: TestClient) -> None:
    protected_requests = [
        ("PUT", "/api/profile"),
        ("POST", "/api/meals"),
        ("POST", "/api/adapt"),
    ]
    for method, url in protected_requests:
        response = client.request(
            method,
            url,
            content=b"{broken",
            headers={"content-type": "application/json"},
        )
        assert response.status_code == 401
        assert response.json()["error"] == "Sign in required"


def test_profile_read_trim_limits_and_invalid_update_is_atomic(
    client: TestClient, test_database
) -> None:
    user = register(client, "profile-api@example.com")
    assert client.get("/api/profile").json() == {
        "profile": {"conditions": "", "allergies": "", "dietaryPreferences": "", "notes": ""}
    }
    saved = client.put(
        "/api/profile",
        json={
            "conditions": "  diabetes  ",
            "allergies": "  shellfish ",
            "dietaryPreferences": " vegetarian ",
            "notes": " Keep chilled ",
        },
    )
    assert saved.status_code == 200
    assert saved.json()["profile"] == {
        "conditions": "diabetes",
        "allergies": "shellfish",
        "dietaryPreferences": "vegetarian",
        "notes": "Keep chilled",
    }

    invalid = client.put("/api/profile", json={"conditions": "x" * 201, "notes": "y" * 2001})
    assert invalid.status_code == 400
    assert set(invalid.json()["errors"]) == {"conditions", "notes"}
    assert client.get("/api/profile").json()["profile"] == saved.json()["profile"]

    accepted = client.put(
        "/api/profile", json={"conditions": "c" * 200, "notes": "n" * 2000}
    )
    assert accepted.status_code == 200
    assert len(accepted.json()["profile"]["conditions"]) == 200
    assert len(accepted.json()["profile"]["notes"]) == 2000

    host, port, database = test_database
    with psycopg.connect(host=host, port=port, user="postgres", dbname=database) as connection:
        row = connection.execute(
            "SELECT count(*) FROM health_profiles WHERE user_id = %s", (user["id"],)
        ).fetchone()
    assert row is not None and row[0] == 1


def test_dish_catalog_details_and_identifier_errors(client: TestClient, test_database) -> None:
    register(client, "dish-api@example.com")
    first_id, image_id = insert_dish(test_database, "API Zucchini")
    second_id, _ = insert_dish(test_database, "API Apple")
    dishes = client.get("/api/dishes")
    assert dishes.status_code == 200
    assert [dish["name"] for dish in dishes.json()["dishes"]] == ["API Apple", "API Zucchini"]
    assert dishes.json()["dishes"][1]["image"] == "/images/API Zucchini.jpg"

    detail = client.get(f"/api/dishes/{first_id}")
    assert detail.status_code == 200
    assert detail.json()["dish"]["id"] == first_id
    assert detail.json()["dish"]["content"] == "Original recipe instructions"
    assert detail.json()["dish"]["ingredients"] == ["beans", "rice"]
    assert detail.json()["dish"]["imageId"] == image_id
    assert client.get("/api/dishes/not-a-uuid").status_code == 400
    assert client.get(f"/api/dishes/{uuid4()}").status_code == 404
    assert client.get(f"/api/dishes/{second_id}").status_code == 200


def test_meal_create_list_read_delete_validation_and_owner_scope(
    client: TestClient, test_database
) -> None:
    owner = register(client, "meal-api-owner@example.com")
    owner_token = client.cookies.get(auth.SESSION_COOKIE)
    assert owner_token is not None
    dish_id, _ = insert_dish(test_database, "API source dish")
    created = client.post(
        "/api/meals",
        json={"title": "  Adapted meal  ", "content": "Dinner recipe", "sourceDishId": dish_id},
    )
    assert created.status_code == 201
    meal_id = created.json()["id"]
    assert client.get("/api/meals").json()["meals"][0]["title"] == "Adapted meal"
    assert client.get(f"/api/meals/{meal_id}").json()["meal"]["content"] == "Dinner recipe"

    for body in (
        {"title": "  ", "content": "recipe"},
        {"title": "t" * 201, "content": "recipe"},
        {"title": "Dinner", "content": ""},
        {"title": "Dinner", "content": "recipe", "unknown": 1},
    ):
        response = client.post("/api/meals", json=body)
        assert response.status_code == 400
        assert response.json()["errors"]

    for source in ("bad-id", str(uuid4())):
        response = client.post(
            "/api/meals", json={"title": "No source", "content": "Recipe", "sourceDishId": source}
        )
        assert response.status_code == 201
    host, port, database = test_database
    with psycopg.connect(host=host, port=port, user="postgres", dbname=database) as connection:
        sources = connection.execute(
            "SELECT title, source_dish_id FROM meals WHERE user_id = %s ORDER BY title",
            (owner["id"],),
        ).fetchall()
    assert sources == [
        ("Adapted meal", UUID(dish_id)),
        ("No source", None),
        ("No source", None),
    ]

    other_id = insert_user(test_database, "meal-api-other@example.com")
    other_token = str(uuid4())
    with psycopg.connect(host=host, port=port, user="postgres", dbname=database) as connection:
        connection.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (%s, %s, %s)",
            (
                auth.hash_token(other_token),
                other_id,
                datetime.now(UTC) + timedelta(days=7),
            ),
        )
    client.cookies.clear()
    client.cookies.set(auth.SESSION_COOKIE, other_token)
    assert client.get(f"/api/meals/{meal_id}").status_code == 404
    assert client.delete(f"/api/meals/{meal_id}").status_code == 404
    client.cookies.clear()
    client.cookies.set(auth.SESSION_COOKIE, owner_token)
    assert client.get("/api/meals/not-a-uuid").status_code == 404
    deleted = client.delete(f"/api/meals/{meal_id}")
    assert deleted.status_code == 204
    assert client.get(f"/api/meals/{meal_id}").status_code == 404
    with psycopg.connect(host=host, port=port, user="postgres", dbname=database) as connection:
        owner_meals = connection.execute(
            "SELECT title FROM meals WHERE user_id = %s", (owner["id"],)
        ).fetchall()
    assert len(owner_meals) == 2


def test_adaptation_auth_validation_not_found_and_utf8_stream(
    client: TestClient, test_database, monkeypatch: pytest.MonkeyPatch
) -> None:
    assert client.post("/api/adapt", json={"dishId": str(uuid4())}).status_code == 401
    user = register(client, "adapt-api@example.com")
    malformed = client.post(
        "/api/adapt", content=b"{", headers={"content-type": "application/json"}
    )
    assert malformed.status_code == 400
    assert client.post("/api/adapt", json={"dishId": "bad"}).status_code == 400
    assert client.post("/api/adapt", json={"dishId": str(uuid4())}).status_code == 404

    dish_id, _ = insert_dish(test_database, "API Adapt Dish")

    class ControlledModel:
        def astream(self, _messages):
            async def chunks():
                yield SimpleNamespace(text="🍜 Crème brûlée")

            return chunks()

    monkeypatch.setenv("AI_API_KEY", "test-api-key")
    monkeypatch.setenv("AI_MODEL", "test-model")
    monkeypatch.setattr(ai, "_create_model", lambda *_: ControlledModel())
    response = client.post("/api/adapt", json={"dishId": dish_id})
    assert response.status_code == 200
    assert response.text == "🍜 Crème brûlée"
    assert response.headers["content-type"].startswith("text/plain")

    def fail_model_creation(*_args):
        raise RuntimeError("provider secret")

    monkeypatch.setattr(ai, "_create_model", fail_model_creation)
    unavailable = client.post("/api/adapt", json={"dishId": dish_id})
    assert unavailable.status_code == 502
    assert "provider secret" not in unavailable.text
    assert client.post("/api/adapt", json={"dishId": str(uuid4())}).status_code == 404
    assert client.get("/api/auth/session").json()["user"]["id"] == user["id"]


@pytest.mark.parametrize(
    ("content", "headers"),
    [
        (b"{", {"content-type": "application/json"}),
        (b"{}", {"content-type": "text/plain"}),
        (b"{}", {"content-type": "application/jsonp"}),
        (b'{"conditions":1}', {"content-type": "application/json"}),
    ],
)
def test_json_body_errors_are_friendly_400s(
    client: TestClient, content: bytes, headers: dict[str, str], test_database
) -> None:
    register(client, "body-errors@example.com")
    response = client.put("/api/profile", content=content, headers=headers)
    assert response.status_code == 400
    assert response.json()["error"]


def test_lifespan_does_not_connect_on_import_and_closes_database(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []

    async def close_db() -> None:
        calls.append("close")

    monkeypatch.setattr(db, "close_db", close_db)
    assert calls == []
    with TestClient(app):
        assert calls == []
    assert calls == ["close"]


def test_uvicorn_module_entrypoints_are_supported() -> None:
    root = Path(__file__).resolve().parents[2]
    for module, working_directory in (("backend.main", root), ("main", root / "backend")):
        completed = subprocess.run(
            [sys.executable, "-c", f"from {module} import app; assert app"],
            cwd=working_directory,
            capture_output=True,
            text=True,
            check=False,
        )
        assert completed.returncode == 0, completed.stderr
