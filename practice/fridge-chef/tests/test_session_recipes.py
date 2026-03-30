"""Tests for session-saved recipe helpers."""

from models.recipe import Recipe
from utils.session_recipes import (
    deduplicate_saved_recipes,
    normalize_saved_recipes,
    recipe_signature,
    serialize_recipe_for_session,
)


def test_serialize_recipe_for_session_from_dataclass():
    """Recipe dataclass instances should be serialized to plain dicts."""
    recipe = Recipe(
        name="테스트 요리",
        description="설명",
        difficulty="쉬움",
        cooking_time=10,
        servings=1,
        available_ingredients=["계란"],
        additional_ingredients=["소금"],
        instructions=["1. 굽기"],
        tips=["따뜻할 때 드세요"],
    )

    serialized = serialize_recipe_for_session(recipe)

    assert serialized["name"] == "테스트 요리"
    assert serialized["ingredients"]["available"] == ["계란"]
    assert serialized["ingredients"]["additional_needed"] == ["소금"]


def test_normalize_saved_recipes_handles_mixed_input():
    """Mixed Recipe/dict inputs should normalize into dictionaries."""
    recipe = Recipe(
        name="첫 번째",
        description="설명",
        difficulty="보통",
        cooking_time=20,
        servings=2,
    )
    recipe_dict = {
        "name": "두 번째",
        "description": "설명2",
        "difficulty": "쉬움",
        "cooking_time": 15,
        "servings": 1,
        "ingredients": {"available": [], "additional_needed": []},
        "instructions": [],
        "tips": [],
    }

    normalized = normalize_saved_recipes([recipe, recipe_dict])

    assert normalized == [recipe.to_dict(), recipe_dict]


def test_normalize_saved_recipes_empty_input():
    """Empty or missing saved recipes should normalize to an empty list."""
    assert normalize_saved_recipes([]) == []
    assert normalize_saved_recipes(None) == []


def test_recipe_signature_is_stable_for_equivalent_dicts():
    """Equivalent recipe dicts should produce the same signature."""
    recipe_a = {
        "name": "테스트",
        "description": "설명",
        "difficulty": "쉬움",
        "cooking_time": 10,
        "servings": 1,
        "ingredients": {"available": ["계란"], "additional_needed": ["소금"]},
        "instructions": ["1. 굽기"],
        "tips": [],
    }
    recipe_b = {
        "tips": [],
        "instructions": ["1. 굽기"],
        "ingredients": {"additional_needed": ["소금"], "available": ["계란"]},
        "servings": 1,
        "cooking_time": 10,
        "difficulty": "쉬움",
        "description": "설명",
        "name": "테스트",
    }

    assert recipe_signature(recipe_a) == recipe_signature(recipe_b)


def test_deduplicate_saved_recipes_preserves_first_occurrence():
    """Duplicate recipes should collapse to a single preserved entry."""
    recipe = {
        "name": "중복 레시피",
        "description": "설명",
        "difficulty": "보통",
        "cooking_time": 20,
        "servings": 2,
        "ingredients": {"available": [], "additional_needed": []},
        "instructions": [],
        "tips": [],
    }

    deduplicated = deduplicate_saved_recipes([recipe, dict(recipe)])

    assert deduplicated == [recipe]
