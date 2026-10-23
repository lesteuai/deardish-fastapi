"""FastAPI entrypoint for local and Vercel backend runtimes."""

from __future__ import annotations

import json
import os
import re
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from types import ModuleType
from typing import Any
from urllib.parse import urlsplit
from uuid import UUID

if not __package__:
    backend_directory = Path(__file__).resolve().parent
    project_directory = backend_directory.parent
    sys.path.insert(0, str(project_directory))
    if not (project_directory / "backend").is_dir():
        package = ModuleType("backend")
        package.__path__ = [str(backend_directory)]
        sys.modules.setdefault("backend", package)

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError

from backend import ai, auth, db, repository
from backend.models import AuthUser, Dish, DishSummary, Meal
from backend.schemas import (
    AdaptBody,
    LoginBody,
    MealBody,
    ProfileBody,
    RegisterBody,
    field_errors,
)

_UUID_PATTERN = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-"
    r"[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    await db.close_db()


app = FastAPI(lifespan=lifespan)


def _json_error(message: str, status: int, errors: dict[str, str] | None = None) -> JSONResponse:
    body: dict[str, Any] = {"error": message}
    if errors is not None:
        body["errors"] = errors
    return JSONResponse(body, status_code=status)


def _normalized_origin(value: str | None) -> str | None:
    if not value or value != value.strip():
        return None
    try:
        parsed = urlsplit(value)
    except ValueError:
        return None
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return None
    if parsed.username or parsed.password or parsed.path not in {"", "/"}:
        return None
    if parsed.query or parsed.fragment:
        return None
    host = parsed.hostname.lower()
    try:
        port = parsed.port
    except ValueError:
        return None
    default_port = 443 if parsed.scheme == "https" else 80
    if ":" in host:
        host = f"[{host}]"
    authority = host if port is None or port == default_port else f"{host}:{port}"
    return f"{parsed.scheme}://{authority}"


def _trusted_origins() -> set[str]:
    environment = os.environ
    origins: set[str] = set()
    configured = _normalized_origin(environment.get("APP_ORIGIN"))
    if configured:
        origins.add(configured)

    vercel_environment = environment.get("VERCEL_ENV")
    if vercel_environment in {"production", "preview"}:
        for key in ("VERCEL_URL", "VERCEL_PROJECT_PRODUCTION_URL"):
            host = environment.get(key, "").strip()
            if host:
                origins.add(_normalized_origin(f"https://{host}") or "")
        origins.discard("")
    else:
        origins.update(
            f"http://{host}:{port}"
            for host in ("localhost", "127.0.0.1")
            for port in (5173, 3000, 8000)
        )
        vercel_url = environment.get("VERCEL_URL", "").strip()
        if vercel_url:
            host = urlsplit(f"//{vercel_url}").hostname
            if host and host.lower() in {"localhost", "127.0.0.1"}:
                origins.add(_normalized_origin(f"http://{vercel_url}") or "")
    origins.discard("")
    return origins


def _origin_error(request: Request) -> JSONResponse | None:
    origin = request.headers.get("origin")
    if origin is not None and _normalized_origin(origin) not in _trusted_origins():
        return _json_error("Origin is not allowed", 403)
    if request.headers.get("sec-fetch-site", "").lower() == "cross-site":
        return _json_error("Cross-site requests are not allowed", 403)
    return None


async def _read_body[BodyModel: BaseModel](
    request: Request, schema: type[BodyModel]
) -> BodyModel | JSONResponse:
    content_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if content_type != "application/json" and not content_type.endswith("+json"):
        return _json_error("A JSON request body is required", 400)
    try:
        raw = await request.json()
    except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
        return _json_error("Malformed JSON request body", 400, {"form": "Invalid JSON"})
    try:
        return schema.model_validate(raw)
    except ValidationError as error:
        errors = field_errors(error.errors(include_url=False))
        return _json_error("Invalid request", 400, errors)


async def _current_user(request: Request) -> AuthUser | None:
    return await auth.validate_session(request.cookies.get(auth.SESSION_COOKIE))


def _user_json(user: AuthUser) -> dict[str, str]:
    return {"id": str(user.id), "email": user.email}


def _set_session_cookie(response: Response, token: str, request: Request) -> None:
    response.set_cookie(
        auth.SESSION_COOKIE,
        token,
        max_age=auth.SESSION_MAX_AGE,
        path="/",
        secure=request.url.scheme == "https",
        httponly=True,
        samesite="lax",
    )


def _clear_session_cookie(response: Response, request: Request) -> None:
    response.delete_cookie(
        auth.SESSION_COOKIE,
        path="/",
        secure=request.url.scheme == "https",
        httponly=True,
        samesite="lax",
    )


def _is_uuid(value: str) -> bool:
    return bool(_UUID_PATTERN.fullmatch(value))


def _dish_summary(dish: DishSummary) -> dict[str, Any]:
    return {
        "id": str(dish.id),
        "name": dish.name,
        "cuisine": dish.cuisine,
        "description": dish.description,
        "image": dish.image_location,
    }


def _dish_detail(dish: Dish) -> dict[str, Any]:
    return {
        **_dish_summary(dish),
        "content": dish.content,
        "lastUpdated": dish.last_updated.isoformat(),
        "ingredients": dish.ingredients,
        "imageId": str(dish.image_id) if dish.image_id else None,
    }


def _meal_json(meal: Meal) -> dict[str, Any]:
    return {
        "id": str(meal.id),
        "title": meal.title,
        "content": meal.content,
        "createdAt": meal.created_at.isoformat(),
    }


@app.exception_handler(Exception)
async def unexpected_error(_: Request, __: Exception) -> JSONResponse:
    return _json_error("The service is unavailable right now. Please try again shortly.", 500)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/auth/session")
async def session(request: Request) -> dict[str, Any]:
    user = await _current_user(request)
    return {"user": _user_json(user) if user else None}


@app.post("/api/auth/register", status_code=201)
async def register(request: Request) -> Response:
    origin_error = _origin_error(request)
    if origin_error:
        return origin_error
    body = await _read_body(request, RegisterBody)
    if isinstance(body, JSONResponse):
        return body
    if body.password != body.confirmPassword:
        return _json_error(
            "Invalid request", 400, {"confirmPassword": "Passwords do not match"}
        )
    user = await auth.register_user(body.email, body.password)
    if user is None:
        return _json_error("Invalid request", 400, {"email": "An account with this email exists"})
    token = await auth.create_session(user.id)
    response = JSONResponse({"user": _user_json(user)}, status_code=201)
    _set_session_cookie(response, token, request)
    return response


@app.post("/api/auth/login")
async def login(request: Request) -> Response:
    origin_error = _origin_error(request)
    if origin_error:
        return origin_error
    body = await _read_body(request, LoginBody)
    if isinstance(body, JSONResponse):
        return body
    user = await auth.authenticate(body.email, body.password)
    if user is None:
        return _json_error("Invalid email or password", 401)
    token = await auth.create_session(user.id)
    response = JSONResponse({"user": _user_json(user)})
    _set_session_cookie(response, token, request)
    return response


@app.post("/api/auth/logout", status_code=204)
async def logout(request: Request) -> Response:
    origin_error = _origin_error(request)
    if origin_error:
        return origin_error
    token = request.cookies.get(auth.SESSION_COOKIE)
    if token:
        await auth.destroy_session(token)
    response = Response(status_code=204)
    _clear_session_cookie(response, request)
    return response


@app.get("/api/profile")
async def get_profile(request: Request) -> Response:
    user = await _current_user(request)
    if user is None:
        return _json_error("Sign in required", 401)
    return JSONResponse({"profile": await repository.get_profile(user.id)})


@app.put("/api/profile")
async def put_profile(request: Request) -> Response:
    origin_error = _origin_error(request)
    if origin_error:
        return origin_error
    user = await _current_user(request)
    if user is None:
        return _json_error("Sign in required", 401)
    body = await _read_body(request, ProfileBody)
    if isinstance(body, JSONResponse):
        return body
    profile = await repository.save_profile(user.id, body.model_dump())
    return JSONResponse({"profile": profile})


@app.get("/api/dishes")
async def list_dishes(request: Request) -> Response:
    user = await _current_user(request)
    if user is None:
        return _json_error("Sign in required", 401)
    dishes = await repository.list_dishes()
    return JSONResponse({"dishes": [_dish_summary(dish) for dish in dishes]})


@app.get("/api/dishes/{dish_id}")
async def get_dish(request: Request, dish_id: str) -> Response:
    user = await _current_user(request)
    if user is None:
        return _json_error("Sign in required", 401)
    if not _is_uuid(dish_id):
        return _json_error("Invalid dish identifier", 400)
    dish = await repository.get_dish(UUID(dish_id))
    if dish is None:
        return _json_error("Dish not found", 404)
    return JSONResponse({"dish": _dish_detail(dish)})


@app.get("/api/meals")
async def list_meals(request: Request) -> Response:
    user = await _current_user(request)
    if user is None:
        return _json_error("Sign in required", 401)
    meals = await repository.list_meals(user.id)
    return JSONResponse({"meals": [_meal_json(meal) for meal in meals]})


@app.get("/api/meals/{meal_id}")
async def get_meal(request: Request, meal_id: str) -> Response:
    user = await _current_user(request)
    if user is None:
        return _json_error("Sign in required", 401)
    if not _is_uuid(meal_id):
        return _json_error("Meal not found", 404)
    meal = await repository.get_meal(user.id, UUID(meal_id))
    if meal is None:
        return _json_error("Meal not found", 404)
    return JSONResponse({"meal": _meal_json(meal)})


@app.post("/api/meals", status_code=201)
async def post_meal(request: Request) -> Response:
    origin_error = _origin_error(request)
    if origin_error:
        return origin_error
    user = await _current_user(request)
    if user is None:
        return _json_error("Sign in required", 401)
    body = await _read_body(request, MealBody)
    if isinstance(body, JSONResponse):
        return body
    source_id: UUID | None = None
    if body.sourceDishId and _is_uuid(body.sourceDishId):
        source_id = UUID(body.sourceDishId)
    meal = await repository.save_meal(user.id, body.title, body.content, source_id)
    if meal is None:
        return _json_error("Unable to save meal", 500)
    return JSONResponse({"id": str(meal.id)}, status_code=201)


@app.delete("/api/meals/{meal_id}", status_code=204)
async def remove_meal(request: Request, meal_id: str) -> Response:
    origin_error = _origin_error(request)
    if origin_error:
        return origin_error
    user = await _current_user(request)
    if user is None:
        return _json_error("Sign in required", 401)
    if not _is_uuid(meal_id) or not await repository.delete_meal(user.id, UUID(meal_id)):
        return _json_error("Meal not found", 404)
    return Response(status_code=204)


@app.post("/api/adapt")
async def adapt_recipe(request: Request) -> Response:
    origin_error = _origin_error(request)
    if origin_error:
        return origin_error
    user = await _current_user(request)
    if user is None:
        return _json_error("Sign in required", 401)
    body = await _read_body(request, AdaptBody)
    if isinstance(body, JSONResponse):
        return body
    if not _is_uuid(body.dishId):
        return _json_error("Invalid dish identifier", 400)
    dish = await repository.get_dish(UUID(body.dishId))
    if dish is None:
        return _json_error("Dish not found", 404)
    profile = await repository.get_profile(user.id)
    return await ai.create_adaptation_response(dish, profile)
