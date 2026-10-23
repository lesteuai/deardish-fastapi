"""Explicit schema setup, insert-only catalog seeding, and backend checks."""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, LiteralString, cast
from uuid import NAMESPACE_URL, uuid5

from psycopg import AsyncConnection
from psycopg.sql import SQL
from psycopg.types.json import Jsonb

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
MIGRATIONS = ROOT / "drizzle"
APP_TABLES = ("images", "users", "sessions", "health_profiles", "dishes", "meals")
SEED_NAMESPACE = uuid5(NAMESPACE_URL, "https://deardish.app/catalog/v1")
CHECKS: dict[str, list[str]] = {
    "lint": ["ruff", "check", "backend"],
    "typecheck": [
        "ty",
        "check",
        "--project",
        ".",
        "--python",
        sys.prefix,
        "--python-version",
        "3.14",
        "backend",
    ],
    "test": ["pytest"],
}


def database_conninfo() -> str:
    if __package__:
        from .db import build_conninfo
    else:
        from db import build_conninfo

    return build_conninfo()


def migration_files() -> list[Path]:
    return sorted(MIGRATIONS.glob("*.sql"))


def statements_from(path: Path) -> list[str]:
    source = path.read_text(encoding="utf-8")
    statements = re.split(r"-->\s*statement-breakpoint", source)
    return [statement.strip() for statement in statements if statement.strip()]


async def setup_schema() -> None:
    """Apply historical migrations once, only to an empty unmanaged database."""
    files = migration_files()
    if not files:
        raise RuntimeError("No historical SQL migrations were found.")

    async with await AsyncConnection.connect(database_conninfo()) as connection:
        async with connection.transaction():
            await connection.execute("SELECT pg_advisory_xact_lock(726341902)")
            cursor = await connection.execute(
                "SELECT to_regclass('public.deardish_schema_migrations') IS NOT NULL"
            )
            ledger_row = await cursor.fetchone()
            if ledger_row is None:
                raise RuntimeError("Unable to inspect the schema migration ledger.")
            ledger_exists = ledger_row[0]
            cursor = await connection.execute(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name = ANY(%s)",
                (list(APP_TABLES),),
            )
            existing = sorted(row[0] for row in await cursor.fetchall())
            if not ledger_exists and existing:
                names = ", ".join(existing)
                raise RuntimeError(
                    f"Refusing setup: existing application tables have no setup ledger ({names}). "
                    "Existing DearDish databases need no schema setup."
                )

            await connection.execute(
                "CREATE TABLE IF NOT EXISTS public.deardish_schema_migrations ("
                "migration_id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
            )
            cursor = await connection.execute(
                "SELECT migration_id FROM public.deardish_schema_migrations"
            )
            applied = {row[0] for row in await cursor.fetchall()}
            for path in files:
                if path.name in applied:
                    continue
                for statement in statements_from(path):
                    await connection.execute(SQL(cast(LiteralString, statement)))
                await connection.execute(
                    "INSERT INTO public.deardish_schema_migrations (migration_id) VALUES (%s)",
                    (path.name,),
                )
    print("Historical schema setup completed.")


def load_seed() -> dict[str, list[dict[str, Any]]]:
    with (BACKEND / "seed.json").open(encoding="utf-8") as seed_file:
        seed = json.load(seed_file)
    return seed


async def seed_catalog() -> None:
    """Add missing seed images and dishes without changing existing catalog rows."""
    seed = load_seed()
    images = seed["images"]
    dishes = seed["dishes"]
    async with await AsyncConnection.connect(database_conninfo()) as connection:
        async with connection.transaction():
            await connection.execute("SELECT pg_advisory_xact_lock(726341903)")
            for image in images:
                await connection.execute(
                    "INSERT INTO public.images (id, location, type) VALUES (%s, %s, %s) "
                    "ON CONFLICT DO NOTHING",
                    (image["id"], image["location"], image["type"]),
                )

            for dish in dishes:
                dish_id = str(uuid5(SEED_NAMESPACE, str(dish["name"])))
                cursor = await connection.execute(
                    "SELECT id FROM public.dishes WHERE name = %s OR id = %s LIMIT 1",
                    (dish["name"], dish_id),
                )
                if await cursor.fetchone() is not None:
                    continue
                await connection.execute(
                    "INSERT INTO public.dishes "
                    "(id, name, cuisine, description, content, ingredients, image_id) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING",
                    (
                        dish_id,
                        dish["name"],
                        dish["cuisine"],
                        dish["description"],
                        dish["content"],
                        Jsonb(dish["ingredients"]),
                        dish["imageId"],
                    ),
                )
    print("Missing catalog seed records added; existing rows were preserved.")


def run_check(name: str) -> None:
    subprocess.run([sys.executable, "-m", *CHECKS[name]], cwd=ROOT, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("setup", "seed", *CHECKS))
    args = parser.parse_args()
    if args.command == "setup":
        asyncio.run(setup_schema())
    elif args.command == "seed":
        asyncio.run(seed_catalog())
    else:
        run_check(args.command)


if __name__ == "__main__":
    main()
