from __future__ import annotations

from backend.prompt import (
    EMPTY_PROFILE_FALLBACK,
    ORIGINAL_RECIPE_FORMAT_PROMPT,
    build_adapt_system_prompt,
    build_adapt_user_prompt,
)


def test_system_prompt_preserves_recipe_sections_and_bold_changes() -> None:
    prompt = build_adapt_system_prompt()

    expected_sections = [
        "1. Recipe title and a one-sentence description.",
        "2. Recipe details: servings, prep time, and cook time.",
        "3. Ingredients: list quantities and ingredients in the order used.",
        "4. Instructions: provide concise numbered cooking steps",
        "5. Changes from the original: list each ingredient or preparation change",
    ]
    positions = [prompt.index(section) for section in expected_sections]

    assert positions == sorted(positions)
    assert "Bolden any changes from the original recipe." in prompt
    assert "replaced, added, removed, or modified" in prompt
    assert "If nothing changed, say so." in prompt


def test_original_recipe_format_reference_preserves_complete_structure() -> None:
    assert "Format the supplied source recipe as the dish’s original recipe." in (
        ORIGINAL_RECIPE_FORMAT_PROMPT
    )
    assert "## {Recipe name}" in ORIGINAL_RECIPE_FORMAT_PROMPT
    assert "**Serves {yield} | Prep {prep time} | Cook {cook time}**" in (
        ORIGINAL_RECIPE_FORMAT_PROMPT
    )
    assert "### Ingredients" in ORIGINAL_RECIPE_FORMAT_PROMPT
    assert "### Method" in ORIGINAL_RECIPE_FORMAT_PROMPT
    assert "Recipe reference: {source URL}" in ORIGINAL_RECIPE_FORMAT_PROMPT
    assert "do not adapt it to a health profile" in ORIGINAL_RECIPE_FORMAT_PROMPT
    assert "write “Not specified”" in ORIGINAL_RECIPE_FORMAT_PROMPT
    assert "Do not invent ingredient amounts, steps, temperatures, timings, or a source URL." in (
        ORIGINAL_RECIPE_FORMAT_PROMPT
    )


def test_user_prompt_includes_full_dish_and_original_recipe_content() -> None:
    dish = {
        "name": "Citrus Tofu Bowl",
        "cuisine": "Vietnamese",
        "description": "A bright bowl with crisp tofu and herbs.",
        "ingredients": ["tofu", "jasmine rice", "lime", "Thai basil"],
        "content": "Press tofu for 20 minutes. Fry until golden. Serve over rice.",
    }

    prompt = build_adapt_user_prompt(dish, {})

    assert prompt == (
        "Dish:\n"
        "Name: Citrus Tofu Bowl\n"
        "Cuisine: Vietnamese\n"
        "Description: A bright bowl with crisp tofu and herbs.\n"
        "Ingredients: tofu, jasmine rice, lime, Thai basil\n"
        "Content: Press tofu for 20 minutes. Fry until golden. Serve over rice.\n\n"
        "Health profile:\n"
        f"{EMPTY_PROFILE_FALLBACK}"
    )


def test_user_prompt_trims_and_includes_populated_profile_fields() -> None:
    profile = {
        "conditions": "  hypertension  ",
        "allergies": "  sesame  ",
        "dietaryPreferences": "  pescatarian  ",
        "notes": "  Avoid raw onion.  ",
    }

    prompt = build_adapt_user_prompt({"name": "Soup"}, profile)

    assert "Conditions: hypertension" in prompt
    assert "Allergies: sesame" in prompt
    assert "Dietary preferences: pescatarian" in prompt
    assert "Notes: Avoid raw onion." in prompt
    assert "  hypertension  " not in prompt
    assert EMPTY_PROFILE_FALLBACK not in prompt


def test_user_prompt_uses_healthy_guidance_for_empty_or_whitespace_profile() -> None:
    for profile in (
        {},
        {
            "conditions": "  ",
            "allergies": "",
            "dietary_preferences": None,
            "notes": "\t",
        },
    ):
        prompt = build_adapt_user_prompt({"name": "Soup"}, profile)

        assert f"Health profile:\n{EMPTY_PROFILE_FALLBACK}" in prompt
        assert "Conditions:" not in prompt
        assert "Allergies:" not in prompt
        assert "Dietary preferences:" not in prompt
        assert "Notes:" not in prompt
