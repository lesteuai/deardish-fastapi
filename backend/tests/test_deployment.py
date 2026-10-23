from __future__ import annotations

import json
import time
from pathlib import Path
from uuid import uuid4

import httpx
import psycopg
import pytest
from backend.tests.deployment_harness import (
    child_environment,
    free_port,
    launch,
    node_legacy_credentials,
    post_form,
    stop,
    table_counts,
    wait_for_server,
)

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
VENV = ROOT / "venv"
PYTHON = VENV / "bin" / "python"
AI_KEY = "integrated-test-key"
AI_MODEL = "integrated-test-model"
FRIENDLY_BACKEND_ERROR = (
    "DearDish services are temporarily unavailable. Please try again shortly."
)


def test_deployment_contracts() -> None:
    config = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
    assert config["services"] == {
        "frontend": {"root": "./"},
        "backend": {"root": "backend/", "entrypoint": "main:app"},
    }
    assert [route["source"] for route in config["rewrites"]] == [
        "/api/(.*)",
        "/(.*)",
    ]
    assert all("destination" in route for route in config["rewrites"])

    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    scripts = package["scripts"]
    for command in (
        "backend:install",
        "backend:dev",
        "backend:lint",
        "backend:typecheck",
        "backend:test",
        "db:setup",
        "db:seed",
    ):
        assert command in scripts
    assert "UV_PROJECT_ENVIRONMENT=../venv" in scripts["backend:install"]
    assert "--project backend" in scripts["backend:install"]
    assert "--python 3.14" in scripts["backend:install"]
    assert "--env-file .env" in scripts["backend:dev"]
    dependencies = {**package.get("dependencies", {}), **package.get("devDependencies", {})}
    assert not any(
        name in dependencies
        for name in ("drizzle-orm", "postgres", "@ai-sdk/openai", "ai")
    )
    assert (BACKEND / ".python-version").read_text(encoding="utf-8").strip().startswith("3.14")
    assert PYTHON.exists()
    env_example = (ROOT / ".env.example").read_text(encoding="utf-8")
    for key in (
        "PGHOST",
        "PGUSER",
        "PGDATABASE",
        "PGPASSWORD",
        "AI_API_KEY",
        "AI_MODEL",
        "APP_ORIGIN",
        "BACKEND_URL",
        "PGPORT",
        "PGSSLMODE",
    ):
        assert f"{key}=" in env_example
    vite_config = (ROOT / "vite.config.ts").read_text(encoding="utf-8")
    assert "server: { proxy: { '/api': backendProxy(backendTarget) } }" in vite_config
    assert "preview: { proxy: { '/api': backendProxy(backendTarget) } }" in vite_config
    private_backend_keys = ("PGHOST", "PGDATABASE", "PGPASSWORD", "AI_API_KEY", "AI_MODEL")
    frontend_sources = (
        path
        for path in (ROOT / "src").rglob("*")
        if path.suffix in {".ts", ".svelte"}
    )
    for source_path in frontend_sources:
        source = source_path.read_text(encoding="utf-8")
        assert not any(key in source for key in private_backend_keys), source_path


@pytest.mark.asyncio
async def test_integrated_http_acceptance(
    test_database: tuple[str, int, str], tmp_path: Path
) -> None:
    host, pg_port, database = test_database
    mode_path = tmp_path / "ai-mode"
    events_path = tmp_path / "ai-events"
    mode_path.write_text("success", encoding="utf-8")
    events_path.write_text("", encoding="utf-8")
    backend_port = free_port()
    frontend_port = free_port()
    backend_origin = f"http://127.0.0.1:{backend_port}"
    frontend_origin = f"http://127.0.0.1:{frontend_port}"
    environment = child_environment(
        host,
        pg_port,
        database,
        frontend_origin,
        backend_origin,
        mode_path,
        events_path,
    )
    backend_log = tmp_path / "backend.log"
    frontend_log = tmp_path / "frontend.log"

    from backend import manage

    await manage.seed_catalog()
    await manage.seed_catalog()
    password, password_hash, token_hash = node_legacy_credentials()
    legacy_email = "legacy@example.test"
    legacy_user_id = "20000000-0000-4000-8000-000000000001"
    legacy_token = "existing-node-session-token"
    with psycopg.connect(
        host=host,
        port=pg_port,
        user="postgres",
        dbname=database,
        autocommit=True,
    ) as connection:
        connection.execute(
            "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
            (legacy_user_id, legacy_email, password_hash),
        )
        connection.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at) "
            "VALUES (%s, %s, now() + interval '1 day')",
            (token_hash, legacy_user_id),
        )
        connection.execute(
            "INSERT INTO health_profiles (user_id, conditions, allergies, "
            "dietary_preferences, notes) VALUES (%s, %s, %s, %s, %s)",
            (legacy_user_id, "legacy condition", "", "", "legacy profile"),
        )
        initial_counts = table_counts(connection)
        migration_row = connection.execute(
            "SELECT count(*) FROM deardish_schema_migrations"
        ).fetchone()
        assert migration_row is not None
        initial_migrations = migration_row[0]
        catalog = connection.execute(
            "SELECT d.id, d.name, d.content, i.location FROM dishes d "
            "LEFT JOIN images i ON i.id = d.image_id ORDER BY d.name"
        ).fetchall()

    backend = launch(
        [
            str(PYTHON),
            "-m",
            "uvicorn",
            "backend.tests.integration_app:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(backend_port),
            "--log-level",
            "warning",
        ],
        environment,
        backend_log,
    )
    frontend = launch(
        [
            "node_modules/.bin/vite",
            "dev",
            "--host",
            "127.0.0.1",
            "--port",
            str(frontend_port),
            "--strictPort",
        ],
        environment,
        frontend_log,
    )
    try:
        wait_for_server(f"{backend_origin}/api/health", backend, backend_log)
        wait_for_server(frontend_origin, frontend, frontend_log)
        with psycopg.connect(
            host=host, port=pg_port, user="postgres", dbname=database
        ) as connection:
            assert table_counts(connection) == initial_counts
            migration_row = connection.execute(
                "SELECT count(*) FROM deardish_schema_migrations"
            ).fetchone()
            assert migration_row is not None and migration_row[0] == initial_migrations

        owner = httpx.Client(base_url=frontend_origin, follow_redirects=False, timeout=15)
        second_owner = httpx.Client(base_url=frontend_origin, follow_redirects=False, timeout=15)
        try:
            landing = owner.get("/")
            assert landing.status_code == 200
            assert "DearDish" in landing.text
            for path in ("/menu", "/profile", "/meals"):
                protected = owner.get(path)
                assert protected.status_code in (302, 303)
                assert protected.headers["location"].endswith("/auth/login")

            invalid = post_form(
                owner,
                frontend_origin,
                "/auth/register",
                {"email": "bad", "password": "short", "confirmPassword": "other"},
            )
            assert invalid.status_code == 400, invalid.text[:500]
            assert "valid email" in invalid.text.lower() or "email" in invalid.text.lower()
            owner_email = f"owner-{uuid4().hex[:8]}@example.test"
            registered = post_form(
                owner,
                frontend_origin,
                "/auth/register",
                {
                    "email": owner_email,
                    "password": "owner-password",
                    "confirmPassword": "owner-password",
                },
            )
            assert registered.status_code == 302
            assert registered.headers["location"].endswith("/menu")
            owner_cookie = owner.cookies.get("deardish_session")
            assert owner_cookie
            register_cookie = next(
                value for value in registered.headers.get_list("set-cookie")
                if value.startswith("deardish_session=")
            ).lower()
            assert "httponly" in register_cookie
            assert "samesite=lax" in register_cookie
            assert "path=/" in register_cookie
            assert "max-age=604800" in register_cookie
            duplicate = post_form(
                owner,
                frontend_origin,
                "/auth/register",
                {
                    "email": owner_email.upper(),
                    "password": "owner-password",
                    "confirmPassword": "owner-password",
                },
            )
            assert duplicate.status_code == 400

            invalid_profile = post_form(
                owner,
                frontend_origin,
                "/profile",
                {
                    "conditions": "x" * 201,
                    "allergies": "",
                    "dietaryPreferences": "",
                    "notes": "",
                },
            )
            assert invalid_profile.status_code == 400
            saved_profile = post_form(
                owner,
                frontend_origin,
                "/profile",
                {
                    "conditions": "  kidney disease  ",
                    "allergies": "  peanuts  ",
                    "dietaryPreferences": " vegetarian ",
                    "notes": " avoid excess sodium ",
                },
            )
            assert saved_profile.status_code == 200
            profile_page = owner.get("/profile")
            assert profile_page.status_code == 200
            assert "kidney disease" in profile_page.text
            assert "peanuts" in profile_page.text

            legacy_cookies = httpx.Cookies()
            legacy_cookies.set("deardish_session", legacy_token, domain="127.0.0.1", path="/")
            legacy = httpx.Client(
                base_url=frontend_origin,
                cookies=legacy_cookies,
                follow_redirects=False,
                timeout=15,
            )
            try:
                legacy_page = legacy.get("/profile")
                assert legacy_page.status_code == 200
                assert "legacy condition" in legacy_page.text
                login = post_form(
                    legacy,
                    frontend_origin,
                    "/auth/login",
                    {"email": legacy_email.upper(), "password": password},
                )
                assert login.status_code == 302
                assert legacy.cookies.get("deardish_session") != legacy_token
            finally:
                legacy.close()

            menu = owner.get("/menu")
            assert menu.status_code == 200
            assert "Tuscan Ribollita" in menu.text
            dish_id, dish_name, original_content, image_location = catalog[0]
            dish_id = str(dish_id)
            detail = owner.get(f"/menu/{dish_id}")
            assert detail.status_code == 200
            assert str(dish_name) in detail.text
            assert str(original_content).splitlines()[0].lstrip("# ") in detail.text
            assert image_location and str(image_location) in detail.text
            assert owner.get(f"/adapt/{dish_id}").status_code == 200

            second_registration = second_owner.post(
                "/api/auth/register",
                headers={"origin": frontend_origin},
                json={
                    "email": f"second-{uuid4().hex[:8]}@example.test",
                    "password": "second-password",
                    "confirmPassword": "second-password",
                },
            )
            assert second_registration.status_code == 201
            meal_response = owner.post(
                "/api/meals",
                headers={"origin": frontend_origin},
                json={
                    "title": "  Adapted bowl  ",
                    "content": "Saved recipe 🍲",
                    "sourceDishId": dish_id,
                },
            )
            assert meal_response.status_code == 201
            meal_id = meal_response.json()["id"]
            meals_page = owner.get("/meals")
            assert meals_page.status_code == 200
            assert "Adapted bowl" in meals_page.text
            assert owner.get(f"/meals/{meal_id}").status_code == 200
            assert "Saved recipe" in owner.get(f"/meals/{meal_id}").text
            assert second_owner.get(f"/api/meals/{meal_id}").status_code == 404
            assert second_owner.delete(
                f"/api/meals/{meal_id}", headers={"origin": frontend_origin}
            ).status_code == 404
            foreign_origin = owner.post(
                "/api/meals",
                headers={"origin": "https://foreign.example"},
                json={"title": "Forbidden", "content": "Should not persist"},
            )
            assert foreign_origin.status_code == 403

            adaptation = owner.post(
                "/api/adapt",
                headers={"origin": frontend_origin},
                json={"dishId": dish_id},
            )
            assert adaptation.status_code == 200
            assert adaptation.headers["content-type"].startswith("text/plain")
            assert adaptation.text == "Café 東京 🍲"
            mode_path.write_text("pretext-error", encoding="utf-8")
            pretext = owner.post(
                "/api/adapt", headers={"origin": frontend_origin}, json={"dishId": dish_id}
            )
            assert pretext.status_code == 502
            assert "private provider detail" not in pretext.text
            mode_path.write_text("midstream-error", encoding="utf-8")
            with owner.stream(
                "POST",
                "/api/adapt",
                headers={"origin": frontend_origin},
                json={"dishId": dish_id},
            ) as interrupted:
                assert interrupted.status_code == 200
                pieces: list[bytes] = []
                aborted = False
                try:
                    for piece in interrupted.iter_bytes():
                        pieces.append(piece)
                except httpx.HTTPError:
                    aborted = True
                partial = b"".join(pieces)
            assert aborted
            assert "Café".encode() in partial
            assert b"private provider detail" not in partial
            mode_path.write_text("cancel", encoding="utf-8")
            with owner.stream(
                "POST",
                "/api/adapt",
                headers={"origin": frontend_origin},
                json={"dishId": dish_id},
            ) as cancelled:
                assert cancelled.status_code == 200
                iterator = cancelled.iter_bytes()
                first_chunk = next(iterator)
                assert first_chunk
            deadline = time.monotonic() + 3
            while time.monotonic() < deadline:
                if "cancel:closed" in events_path.read_text(encoding="utf-8"):
                    break
                time.sleep(0.05)
            assert "cancel:closed" in events_path.read_text(encoding="utf-8")

            deleted = owner.delete(
                f"/api/meals/{meal_id}", headers={"origin": frontend_origin}
            )
            assert deleted.status_code == 204
            assert owner.get(f"/api/meals/{meal_id}").status_code == 404
            logout = post_form(owner, frontend_origin, "/auth/logout", {"logout": "1"})
            assert logout.status_code == 302
            assert owner.cookies.get("deardish_session") is None
            cleared_session = owner.get(
                "/api/auth/session", headers={"cookie": f"deardish_session={owner_cookie}"}
            )
            assert cleared_session.json() == {"user": None}
            failed_login = post_form(
                owner,
                frontend_origin,
                "/auth/login",
                {"email": owner_email, "password": "wrong-password"},
            )
            assert failed_login.status_code == 400
            assert "email or password" in failed_login.text.lower()
        finally:
            owner.close()
            second_owner.close()
    finally:
        stop(frontend)
        stop(backend)

    frontend_down = launch(
        [
            "node_modules/.bin/vite",
            "dev",
            "--host",
            "127.0.0.1",
            "--port",
            str(frontend_port),
            "--strictPort",
        ],
        environment,
        frontend_log,
    )
    try:
        wait_for_server(frontend_origin, frontend_down, frontend_log)
        with httpx.Client(base_url=frontend_origin, timeout=10) as client:
            unavailable = client.get("/api/health")
            assert unavailable.status_code == 502
            assert unavailable.json() == {"error": FRIENDLY_BACKEND_ERROR}
            action_error = post_form(
                client,
                frontend_origin,
                "/auth/login",
                {"email": "offline@example.test", "password": "password"},
            )
            assert action_error.status_code == 502
            assert FRIENDLY_BACKEND_ERROR in action_error.text
    finally:
        stop(frontend_down)
