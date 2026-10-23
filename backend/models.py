"""Typed row models for the existing PostgreSQL schema."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


def to_camel(name: str) -> str:
    first, *rest = name.split("_")
    return first + "".join(part.title() for part in rest)


class DbRow(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class AuthUser(DbRow):
    id: UUID
    email: str


class UserCredentials(AuthUser):
    password_hash: str
    created_at: datetime


class Session(DbRow):
    token_hash: str
    user_id: UUID
    expires_at: datetime


class HealthProfile(DbRow):
    user_id: UUID
    conditions: str | None
    allergies: str | None
    dietary_preferences: str | None
    notes: str | None
    updated_at: datetime


class Image(DbRow):
    id: UUID
    location: str
    type: str


class DishSummary(DbRow):
    id: UUID
    name: str
    cuisine: str
    description: str
    image_location: str | None = None


class Dish(DishSummary):
    content: str
    last_updated: datetime
    ingredients: list[str]
    image_id: UUID | None


class Meal(DbRow):
    id: UUID
    user_id: UUID
    title: str
    content: str
    source_dish_id: UUID | None
    created_at: datetime
