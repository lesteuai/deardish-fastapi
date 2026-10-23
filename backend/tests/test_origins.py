from __future__ import annotations

import pytest
from backend import ai, auth, repository
from backend.main import _trusted_origins, app
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def clear_origin_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in (
        "APP_ORIGIN",
        "VERCEL_ENV",
        "VERCEL_URL",
        "VERCEL_PROJECT_PRODUCTION_URL",
    ):
        monkeypatch.delenv(name, raising=False)


@pytest.mark.parametrize(
    "origin",
    [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
    ],
)
def test_local_development_origins_are_trusted(origin: str) -> None:
    assert origin in _trusted_origins()


def test_vercel_dev_allows_local_urls_and_localhost_vercel_url(monkeypatch) -> None:
    monkeypatch.setenv("VERCEL_ENV", "development")
    monkeypatch.setenv("VERCEL_URL", "localhost:3000")
    origins = _trusted_origins()
    assert "http://localhost:3000" in origins
    assert "http://localhost:5173" in origins


@pytest.mark.parametrize("environment", ["production", "preview"])
def test_hosted_vercel_environments_use_https_deployment_hosts(
    monkeypatch, environment: str
) -> None:
    monkeypatch.setenv("VERCEL_ENV", environment)
    monkeypatch.setenv("VERCEL_URL", "feature-branch.example.vercel.app")
    monkeypatch.setenv("VERCEL_PROJECT_PRODUCTION_URL", "deardish.example.com")
    origins = _trusted_origins()
    assert origins == {
        "https://feature-branch.example.vercel.app",
        "https://deardish.example.com",
    }


def test_app_origin_is_normalized_and_added_to_vercel_allowlist(monkeypatch) -> None:
    monkeypatch.setenv("VERCEL_ENV", "production")
    monkeypatch.setenv("VERCEL_URL", "deardish.example.com")
    monkeypatch.setenv("APP_ORIGIN", "https://frontend.example.com/")
    assert _trusted_origins() == {
        "https://deardish.example.com",
        "https://frontend.example.com",
    }


def test_app_origin_is_supported_for_local_and_missing_origin_is_allowed(
    monkeypatch, test_database
) -> None:
    monkeypatch.setenv("APP_ORIGIN", "https://custom.example.com")
    assert "https://custom.example.com" in _trusted_origins()
    with TestClient(app) as client:
        response = client.post(
            "/api/auth/register",
            json={
                "email": "cli@example.com",
                "password": "long-enough-password",
                "confirmPassword": "long-enough-password",
            },
        )
    assert response.status_code == 201


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("POST", "/api/adapt"),
        ("PUT", "/api/profile"),
        ("POST", "/api/meals"),
        ("DELETE", "/api/meals/not-a-uuid"),
        ("POST", "/api/auth/register"),
        ("POST", "/api/auth/login"),
        ("POST", "/api/auth/logout"),
    ],
)
@pytest.mark.parametrize(
    "origin_headers",
    [
        {"origin": "https://attacker.example"},
        {"sec-fetch-site": "cross-site"},
    ],
    ids=("foreign-origin", "cross-site"),
)
def test_all_mutations_reject_untrusted_origins_before_auth_body_or_database(
    method: str,
    path: str,
    origin_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def unexpected_service_call(*_args, **_kwargs):
        pytest.fail("Origin rejection must happen before authentication, database, or AI calls")

    for function_name in (
        "validate_session",
        "register_user",
        "authenticate",
        "create_session",
        "destroy_session",
    ):
        monkeypatch.setattr(auth, function_name, unexpected_service_call)
    for function_name in (
        "get_dish",
        "get_profile",
        "save_profile",
        "save_meal",
        "delete_meal",
    ):
        monkeypatch.setattr(repository, function_name, unexpected_service_call)
    monkeypatch.setattr(ai, "create_adaptation_response", unexpected_service_call)

    headers = {"content-type": "application/json", **origin_headers}
    with TestClient(app) as client:
        client.cookies.set(auth.SESSION_COOKIE, "untrusted-session")
        response = client.request(
            method,
            path,
            content=b"{broken",
            headers=headers,
        )

    assert response.status_code == 403
    assert response.json()["error"]
