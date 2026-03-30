"""Helpers for storing recipe data safely in Streamlit session state."""

import json

from models.recipe import Recipe


def serialize_recipe_for_session(recipe: Recipe | dict) -> dict:
    """Convert a recipe object into a session-safe dictionary."""
    if isinstance(recipe, Recipe):
        return recipe.to_dict()
    return recipe


def normalize_saved_recipes(recipes: list[Recipe | dict] | None) -> list[dict]:
    """Normalize mixed saved-recipe session data into dictionaries."""
    if not recipes:
        return []
    return [serialize_recipe_for_session(recipe) for recipe in recipes]


def recipe_signature(recipe: Recipe | dict) -> str:
    """Create a stable signature for comparing recipe content."""
    recipe_data = serialize_recipe_for_session(recipe)
    return json.dumps(recipe_data, ensure_ascii=False, sort_keys=True)


def deduplicate_saved_recipes(recipes: list[Recipe | dict] | None) -> list[dict]:
    """Deduplicate recipes while preserving the original order."""
    normalized = normalize_saved_recipes(recipes)
    seen = set()
    deduplicated = []

    for recipe_data in normalized:
        signature = recipe_signature(recipe_data)
        if signature in seen:
            continue
        seen.add(signature)
        deduplicated.append(recipe_data)

    return deduplicated
