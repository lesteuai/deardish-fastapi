"""Owner-scoped access to existing DearDish PostgreSQL records."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from .db import fetch_models, get_db
from .models import Dish, DishSummary, HealthProfile, Meal


def _uuid_or_none(value: UUID | str | None) -> UUID | None:
    if value is None:
        return None
    try:
        return value if isinstance(value, UUID) else UUID(value)
    except (AttributeError, TypeError, ValueError):
        return None


def _profile_fields(row: HealthProfile | None) -> dict[str, str]:
    """Expose the frontend profile shape while normalizing absent nullable columns."""
    return {
        "conditions": row.conditions or "" if row else "",
        "allergies": row.allergies or "" if row else "",
        "dietaryPreferences": row.dietary_preferences or "" if row else "",
        "notes": row.notes or "" if row else "",
    }


async def get_profile(user_id: UUID | str) -> dict[str, str]:
    normalized_user_id = _uuid_or_none(user_id)
    if normalized_user_id is None:
        return _profile_fields(None)
    db = await get_db()
    rows = await fetch_models(
        db,
        """SELECT user_id, conditions, allergies, dietary_preferences, notes, updated_at
            FROM health_profiles WHERE user_id = %(user_id)s LIMIT 1""",
        {"user_id": normalized_user_id},
        HealthProfile,
    )
    return _profile_fields(rows[0] if rows else None)


async def save_profile(user_id: UUID | str, fields: dict[str, Any]) -> dict[str, str]:
    normalized_user_id = _uuid_or_none(user_id)
    if normalized_user_id is None:
        raise ValueError("Invalid user identifier")
    conditions = fields.get("conditions") or ""
    allergies = fields.get("allergies") or ""
    dietary_preferences = fields.get("dietaryPreferences", fields.get("dietary_preferences")) or ""
    notes = fields.get("notes") or ""
    db = await get_db()
    rows = await fetch_models(
        db,
        """INSERT INTO health_profiles
            (user_id, conditions, allergies, dietary_preferences, notes, updated_at)
            VALUES (
                %(user_id)s, %(conditions)s, %(allergies)s,
                %(dietary_preferences)s, %(notes)s, now()
            )
            ON CONFLICT (user_id) DO UPDATE SET
                conditions = EXCLUDED.conditions,
                allergies = EXCLUDED.allergies,
                dietary_preferences = EXCLUDED.dietary_preferences,
                notes = EXCLUDED.notes,
                updated_at = now()
            RETURNING user_id, conditions, allergies, dietary_preferences, notes, updated_at""",
        {
            "user_id": normalized_user_id,
            "conditions": conditions,
            "allergies": allergies,
            "dietary_preferences": dietary_preferences,
            "notes": notes,
        },
        HealthProfile,
    )
    return _profile_fields(rows[0] if rows else None)


async def list_dishes() -> list[DishSummary]:
    db = await get_db()
    return await fetch_models(
        db,
        """SELECT d.id, d.name, d.cuisine, d.description, i.location AS image_location
            FROM dishes AS d
            LEFT JOIN images AS i ON i.id = d.image_id
            ORDER BY d.name ASC""",
        {},
        DishSummary,
    )


async def get_dish(dish_id: UUID | str) -> Dish | None:
    normalized_dish_id = _uuid_or_none(dish_id)
    if normalized_dish_id is None:
        return None
    db = await get_db()
    dishes = await fetch_models(
        db,
        """SELECT d.id, d.name, d.cuisine, d.description,
                   i.location AS image_location, d.content, d.last_updated,
                   d.ingredients, d.image_id
            FROM dishes AS d
            LEFT JOIN images AS i ON i.id = d.image_id
            WHERE d.id = %(dish_id)s
            LIMIT 1""",
        {"dish_id": normalized_dish_id},
        Dish,
    )
    return dishes[0] if dishes else None


async def list_meals(user_id: UUID | str) -> list[Meal]:
    normalized_user_id = _uuid_or_none(user_id)
    if normalized_user_id is None:
        return []
    db = await get_db()
    return await fetch_models(
        db,
        """SELECT id, user_id, title, content, source_dish_id, created_at
            FROM meals WHERE user_id = %(user_id)s
            ORDER BY created_at DESC""",
        {"user_id": normalized_user_id},
        Meal,
    )


async def get_meal(user_id: UUID | str, meal_id: UUID | str) -> Meal | None:
    normalized_user_id = _uuid_or_none(user_id)
    normalized_meal_id = _uuid_or_none(meal_id)
    if normalized_user_id is None or normalized_meal_id is None:
        return None
    db = await get_db()
    meals = await fetch_models(
        db,
        """SELECT id, user_id, title, content, source_dish_id, created_at
            FROM meals WHERE user_id = %(user_id)s AND id = %(meal_id)s
            LIMIT 1""",
        {"user_id": normalized_user_id, "meal_id": normalized_meal_id},
        Meal,
    )
    return meals[0] if meals else None


async def save_meal(
    user_id: UUID | str,
    title: str,
    content: str,
    source_dish_id: UUID | str | None = None,
) -> Meal | None:
    normalized_user_id = _uuid_or_none(user_id)
    normalized_source_id = _uuid_or_none(source_dish_id)
    if normalized_user_id is None:
        raise ValueError("Invalid user identifier")
    if not isinstance(title, str) or not isinstance(content, str):
        raise ValueError("Meal title and content must be text")
    normalized_title = title.strip()
    if not normalized_title or len(normalized_title) > 200 or not content:
        raise ValueError("Invalid meal title or content")
    db = await get_db()
    meals = await fetch_models(
        db,
        """INSERT INTO meals (user_id, title, content, source_dish_id)
            VALUES (
                %(user_id)s, %(title)s, %(content)s,
                CASE WHEN EXISTS (
                    SELECT 1 FROM dishes WHERE id = %(source_dish_id)s FOR KEY SHARE
                ) THEN %(source_dish_id)s ELSE NULL END
            )
            RETURNING id, user_id, title, content, source_dish_id, created_at""",
        {
            "user_id": normalized_user_id,
            "title": normalized_title,
            "content": content,
            "source_dish_id": normalized_source_id,
        },
        Meal,
    )
    return meals[0] if meals else None


async def delete_meal(user_id: UUID | str, meal_id: UUID | str) -> bool:
    normalized_user_id = _uuid_or_none(user_id)
    normalized_meal_id = _uuid_or_none(meal_id)
    if normalized_user_id is None or normalized_meal_id is None:
        return False
    db = await get_db()
    deleted = await fetch_models(
        db,
        """DELETE FROM meals
            WHERE user_id = %(user_id)s AND id = %(meal_id)s
            RETURNING id, user_id, title, content, source_dish_id, created_at""",
        {"user_id": normalized_user_id, "meal_id": normalized_meal_id},
        Meal,
    )
    return bool(deleted)
