"""Recipe adaptation prompts copied from the existing application."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

SYSTEM_PROMPT = "\n\n".join(
    [
        (
            "You are DearDish, an assistant that adapts restaurant-style dishes for people with "
            "health needs."
        ),
        "\n".join(
            [
                (
                    "Rewrite the provided dish as a complete, cookable recipe that respects the "
                    "diner's health profile. Format the response in Markdown with these sections, "
                    "in this order:"
                ),
                "1. Recipe title and a one-sentence description.",
                (
                    "2. Recipe details: servings, prep time, and cook time. If a value is "
                    "uncertain, "
                    "give a reasonable estimate."
                ),
                (
                    "3. Ingredients: list quantities and ingredients in the order used. Name "
                    "substitutions clearly beside the adapted ingredient."
                ),
                (
                    "4. Instructions: provide concise numbered cooking steps with temperatures, "
                    "timings, and doneness cues where useful."
                ),
                (
                    "5. Changes from the original: list each ingredient or preparation change, "
                    "stating what was replaced, added, removed, or modified and the reason. "
                    "Mention "
                    "only changes that were actually made. If nothing changed, say so. Base this "
                    "comparison on the supplied dish name, description, and ingredients. Do not "
                    "imply that the original included quantities or preparation details that were "
                    "not provided. Keep the dish recognizable and flavorful."
                ),
                "Bolden any changes from the original recipe.",
            ]
        ),
    ]
)

ORIGINAL_RECIPE_FORMAT_PROMPT = "\n".join(
    [
        (
            "Format the supplied source recipe as the dish’s original recipe. Preserve the source "
            "recipe and do not adapt it to a health profile or change its ingredients or cooking "
            "method."
        ),
        "Return only Markdown using this structure:",
        "## {Recipe name}",
        "",
        "**Serves {yield} | Prep {prep time} | Cook {cook time}**",
        "",
        "### Ingredients",
        "- List ingredients with source quantities, in the order used.",
        "",
        "### Method",
        (
            "1. Present the original method as concise, numbered, cookable steps. Preserve "
            "temperatures, timings, and doneness cues from the source."
        ),
        "",
        "Recipe reference: {source URL}",
        "",
        (
            "Use metadata only when it is provided by the source; write “Not specified” for "
            "missing yield or times instead of guessing. Do not invent ingredient amounts, steps, "
            "temperatures, timings, or a source URL. Keep essential recipe details intact while "
            "paraphrasing instructions instead of copying source wording verbatim."
        ),
    ]
)

EMPTY_PROFILE_FALLBACK = "\n".join(
    [
        "No health profile was provided, so apply general healthy-cooking guidance:",
        (
            "- Lower sodium by seasoning with herbs, spices, citrus, and vinegar instead of "
            "added salt."
        ),
        "- Cut added sugar and refined carbohydrates, favoring whole grains.",
        "- Use wholesome swaps like olive oil for butter and lean proteins where possible.",
        "- Keep the restaurant-style flavor and presentation.",
    ]
)


def _value(record: Any, snake_name: str, camel_name: str | None = None) -> Any:
    if isinstance(record, Mapping):
        if snake_name in record:
            return record[snake_name]
        if camel_name is not None and camel_name in record:
            return record[camel_name]
        return ""
    if hasattr(record, snake_name):
        return getattr(record, snake_name)
    if camel_name is not None and hasattr(record, camel_name):
        return getattr(record, camel_name)
    return ""


def _labelled_line(label: str, value: Any) -> str | None:
    trimmed = "" if value is None else str(value).strip()
    return f"{label}: {trimmed}" if trimmed else None


def build_adapt_system_prompt() -> str:
    return SYSTEM_PROMPT


def build_adapt_user_prompt(dish: Any, profile: Any) -> str:
    ingredients = _value(dish, "ingredients")
    if not isinstance(ingredients, (list, tuple)):
        ingredients = []

    dish_section = "\n".join(
        [
            "Dish:",
            f"Name: {_value(dish, 'name')}",
            f"Cuisine: {_value(dish, 'cuisine')}",
            f"Description: {_value(dish, 'description')}",
            f"Ingredients: {', '.join(str(item) for item in ingredients)}",
            f"Content: {_value(dish, 'content')}",
        ]
    )

    profile_lines = [
        _labelled_line("Conditions", _value(profile, "conditions")),
        _labelled_line("Allergies", _value(profile, "allergies")),
        _labelled_line(
            "Dietary preferences",
            _value(profile, "dietary_preferences", "dietaryPreferences"),
        ),
        _labelled_line("Notes", _value(profile, "notes")),
    ]
    present_profile_lines = [line for line in profile_lines if line is not None]
    profile_section = "\n".join(
        ["Health profile:", *(present_profile_lines or [EMPTY_PROFILE_FALLBACK])]
    )
    return f"{dish_section}\n\n{profile_section}"
