from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

import psycopg
import pytest
from backend import manage, repository
from psycopg.types.json import Jsonb


def insert_user(test_database: tuple[str, int, str], email: str) -> str:
    host, port, database = test_database
    user_id = uuid4()
    with psycopg.connect(host=host, port=port, user="postgres", dbname=database) as connection:
        connection.execute(
            "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
            (user_id, email, "unused"),
        )
    return str(user_id)


def insert_dish(test_database: tuple[str, int, str], name: str) -> tuple[str, str]:
    host, port, database = test_database
    dish_id = uuid4()
    image_id = uuid4()
    with psycopg.connect(host=host, port=port, user="postgres", dbname=database) as connection:
        connection.execute(
            "INSERT INTO images (id, location, type) VALUES (%s, %s, %s)",
            (image_id, f"/images/{name}.jpg", "image/jpeg"),
        )
        connection.execute(
            """INSERT INTO dishes
               (id, name, cuisine, description, ingredients, image_id, content)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (
                dish_id,
                name,
                "Test cuisine",
                f"Description of {name}",
                Jsonb(["beans", "rice"]),
                image_id,
                "Original recipe instructions",
            ),
        )
    return str(dish_id), str(image_id)


@pytest.mark.asyncio
async def test_profile_upsert_returns_postgres_values_and_supports_empty_profile(test_database):
    user_id = insert_user(test_database, "profile@example.com")

    assert await repository.get_profile(user_id) == {
        "conditions": "",
        "allergies": "",
        "dietaryPreferences": "",
        "notes": "",
    }
    saved = await repository.save_profile(
        user_id,
        {
            "conditions": "  diabetes  ",
            "allergies": "peanuts",
            "dietaryPreferences": "vegetarian",
            "notes": "Use the medication schedule",
        },
    )
    updated = await repository.save_profile(user_id, {"allergies": "tree nuts"})
    host, port, database = test_database
    with psycopg.connect(host=host, port=port, user="postgres", dbname=database) as connection:
        rows = connection.execute(
            "SELECT conditions, allergies, dietary_preferences, notes, updated_at "
            "FROM health_profiles WHERE user_id = %s",
            (user_id,),
        ).fetchall()

    assert saved["conditions"] == "  diabetes  "
    assert updated == {
        "conditions": "",
        "allergies": "tree nuts",
        "dietaryPreferences": "",
        "notes": "",
    }
    assert len(rows) == 1
    assert rows[0][:4] == ("", "tree nuts", "", "")
    assert rows[0][4].tzinfo is not None


@pytest.mark.asyncio
async def test_catalog_reads_ordered_images_jsonb_and_original_content(test_database):
    later_id, _ = insert_dish(test_database, "Zucchini bowl")
    earlier_id, image_id = insert_dish(test_database, "Apple soup")

    dishes = await repository.list_dishes()
    detail = await repository.get_dish(earlier_id)
    host, port, database = test_database
    with psycopg.connect(host=host, port=port, user="postgres", dbname=database) as connection:
        connection.execute(
            "UPDATE dishes SET image_id = NULL WHERE id = %s", (later_id,)
        )
    dishes_without_image = await repository.list_dishes()

    assert [dish.name for dish in dishes] == ["Apple soup", "Zucchini bowl"]
    assert dishes[0].image_location == "/images/Apple soup.jpg"
    assert detail is not None
    assert str(detail.id) == earlier_id
    assert detail.ingredients == ["beans", "rice"]
    assert detail.content == "Original recipe instructions"
    assert str(detail.image_id) == image_id
    assert detail.last_updated.tzinfo is not None
    assert dishes_without_image[1].image_location is None


@pytest.mark.asyncio
async def test_meal_returning_owner_scope_source_dish_nulling_and_delete(test_database):
    owner_id = insert_user(test_database, "meal-owner@example.com")
    other_user_id = insert_user(test_database, "other-owner@example.com")
    dish_id, _ = insert_dish(test_database, "Source dish")

    saved = await repository.save_meal(owner_id, "  Adapted dinner  ", "Cooked content", dish_id)
    invalid_source = await repository.save_meal(
        owner_id, "Without source", "Still readable", "malformed-id"
    )
    nonexistent_source = await repository.save_meal(
        owner_id, "Unknown source", "Still readable", str(uuid4())
    )
    assert saved is not None
    host, port, database = test_database
    with psycopg.connect(host=host, port=port, user="postgres", dbname=database) as connection:
        connection.execute("DELETE FROM dishes WHERE id = %s", (dish_id,))

    meals = await repository.list_meals(owner_id)
    owner_read = await repository.get_meal(owner_id, saved.id)
    other_read = await repository.get_meal(other_user_id, saved.id)
    deleted_by_other = await repository.delete_meal(other_user_id, saved.id)
    deleted_by_owner = await repository.delete_meal(owner_id, saved.id)
    removed_read = await repository.get_meal(owner_id, saved.id)

    assert saved.title == "Adapted dinner"
    assert str(saved.source_dish_id) == dish_id
    assert saved.created_at.utcoffset() == timedelta(0)
    assert invalid_source is not None and invalid_source.source_dish_id is None
    assert nonexistent_source is not None and nonexistent_source.source_dish_id is None
    assert meals[0].source_dish_id is None
    assert owner_read is not None and owner_read.content == "Cooked content"
    assert other_read is None
    assert deleted_by_other is False
    assert deleted_by_owner is True
    assert removed_read is None


@pytest.mark.asyncio
async def test_setup_and_repeat_seed_preserve_catalog_ids_and_references(test_database):
    host, port, database = test_database
    legacy_dish = manage.load_seed()["dishes"][0]
    legacy_id = uuid4()
    with psycopg.connect(host=host, port=port, user="postgres", dbname=database) as connection:
        connection.execute(
            """INSERT INTO dishes (id, name, cuisine, description, content, ingredients)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (
                legacy_id,
                legacy_dish["name"],
                legacy_dish["cuisine"],
                legacy_dish["description"],
                legacy_dish["content"],
                Jsonb(legacy_dish["ingredients"]),
            ),
        )
    await manage.seed_catalog()
    with psycopg.connect(host=host, port=port, user="postgres", dbname=database) as connection:
        before = connection.execute(
            "SELECT d.id, d.name, d.image_id, i.id FROM dishes d "
            "LEFT JOIN images i ON i.id = d.image_id ORDER BY d.name"
        ).fetchall()

    await manage.setup_schema()
    await manage.seed_catalog()
    with psycopg.connect(host=host, port=port, user="postgres", dbname=database) as connection:
        after = connection.execute(
            "SELECT d.id, d.name, d.image_id, i.id FROM dishes d "
            "LEFT JOIN images i ON i.id = d.image_id ORDER BY d.name"
        ).fetchall()
        migration_rows = connection.execute(
            "SELECT count(*) FROM deardish_schema_migrations"
        ).fetchone()

    assert before
    assert after == before
    assert any(row[0] == legacy_id and row[1] == legacy_dish["name"] for row in after)
    assert migration_rows is not None and migration_rows[0] == 3
