"""Validated request bodies for the FastAPI API."""

from __future__ import annotations

import re
from collections.abc import Sequence
from typing import Any

from pydantic import BaseModel, ConfigDict, StrictStr, field_validator

EMAIL_PATTERN = re.compile(
    r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@"
    r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?"
    r"(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$"
)
ShortText = StrictStr
LongText = StrictStr


class RequestBody(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RegisterBody(RequestBody):
    email: StrictStr
    password: StrictStr
    confirmPassword: StrictStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        email = value.strip().lower()
        local_part = email.partition("@")[0]
        if (
            len(email) > 254
            or local_part.startswith(".")
            or local_part.endswith(".")
            or ".." in local_part
            or not EMAIL_PATTERN.fullmatch(email)
        ):
            raise ValueError("Enter a valid email address")
        return email

    @field_validator("password")
    @classmethod
    def validate_password_length(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters")
        return value


class LoginBody(RequestBody):
    email: StrictStr
    password: StrictStr

    @field_validator("email", "password")
    @classmethod
    def trim_required(cls, value: str, info: Any) -> str:
        if info.field_name == "email":
            value = value.strip().lower()
        if not value:
            raise ValueError("Required")
        return value


class ProfileBody(RequestBody):
    conditions: ShortText = ""
    allergies: ShortText = ""
    dietaryPreferences: ShortText = ""
    notes: LongText = ""

    @field_validator("conditions", "allergies", "dietaryPreferences", "notes")
    @classmethod
    def trim_text(cls, value: str, info: Any) -> str:
        value = value.strip()
        max_length = 2000 if info.field_name == "notes" else 200
        if len(value) > max_length:
            raise ValueError(f"Must be at most {max_length} characters")
        return value


class AdaptBody(RequestBody):
    dishId: StrictStr


class MealBody(RequestBody):
    title: StrictStr
    content: StrictStr
    sourceDishId: StrictStr | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title is required")
        if len(value) > 200:
            raise ValueError("Title must be at most 200 characters")
        return value

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        if not value:
            raise ValueError("Content is required")
        return value


def field_errors(errors: Sequence[Any]) -> dict[str, str]:
    result: dict[str, str] = {}
    for error in errors:
        location = error.get("loc", ())
        key = str(location[0]) if location else "form"
        message = str(error.get("msg", "Invalid value"))
        if message.startswith("Value error, "):
            message = message.removeprefix("Value error, ")
        result.setdefault(key, message)
    return result
