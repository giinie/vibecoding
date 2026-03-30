"""Social sharing service for recipes."""
import secrets
from io import BytesIO
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import qrcode

from db.database import get_db
from db.models import SavedRecipe
from services.config import Config


class SharingService:
    """Service for generating shareable recipe links and content."""

    @staticmethod
    def _get_owned_recipe(session, saved_recipe_id: int, user_id: int | None) -> SavedRecipe | None:
        """Return a recipe scoped to the requested owner when provided."""
        query = session.query(SavedRecipe).filter(SavedRecipe.id == saved_recipe_id)
        if user_id is not None:
            query = query.filter(SavedRecipe.user_id == user_id)
        return query.first()

    @staticmethod
    def generate_share_id() -> str:
        """Generate unique share ID for recipe.

        Returns:
            URL-safe random string.
        """
        return secrets.token_urlsafe(8)

    @staticmethod
    def create_share_link(share_id: str) -> str:
        """Create shareable URL.

        Args:
            share_id: Unique share identifier.

        Returns:
            Full shareable URL.
        """
        base_url = Config.APP_BASE_URL.rstrip("/")
        parsed = urlsplit(base_url)
        query_params = dict(parse_qsl(parsed.query, keep_blank_values=True))
        query_params["share_id"] = share_id
        return urlunsplit(
            (
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                urlencode(query_params),
                parsed.fragment,
            )
        )

    @staticmethod
    def generate_qr_code(url: str) -> BytesIO:
        """Generate QR code image for URL.

        Args:
            url: URL to encode.

        Returns:
            BytesIO buffer containing PNG image.
        """
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(url)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        return buffer

    @staticmethod
    def format_recipe_for_sharing(recipe: dict) -> str:
        """Format recipe as copyable text for messaging apps.

        Args:
            recipe: Recipe data dict.

        Returns:
            Formatted text string.
        """
        ingredients = recipe.get("ingredients", {})
        available = ingredients.get("available", [])
        additional = ingredients.get("additional_needed", [])
        all_ingredients = available + additional

        instructions = recipe.get("instructions", [])
        tips = recipe.get("tips", [])

        text = f"""🍳 {recipe.get('name', '레시피')}
⏱️ {recipe.get('cooking_time', 30)}분 | 👨‍🍳 {recipe.get('difficulty', '보통')} | 🍽️ {recipe.get('servings', 2)}인분

📝 {recipe.get('description', '')}

📦 재료: {', '.join(all_ingredients)}

📋 만드는 법:
{chr(10).join(instructions)}
"""

        if tips:
            text += f"\n💡 팁: {tips[0]}"

        text += "\n\n🍳 Fridge Chef에서 만들어보세요!"
        return text

    @staticmethod
    def enable_sharing(saved_recipe_id: int, user_id: int | None = None) -> str | None:
        """Enable sharing for a saved recipe.

        Args:
            saved_recipe_id: Saved recipe ID.
            user_id: Optional owner ID used to enforce authorization.

        Returns:
            Share ID if successful, None otherwise.
        """
        with get_db() as session:
            recipe = SharingService._get_owned_recipe(session, saved_recipe_id, user_id)

            if not recipe:
                return None

            if not recipe.share_id:
                recipe.share_id = SharingService.generate_share_id()
                session.commit()

            return recipe.share_id

    @staticmethod
    def get_shared_recipe(share_id: str) -> dict | None:
        """Get recipe by share ID.

        Args:
            share_id: Share identifier.

        Returns:
            Recipe data dict or None.
        """
        with get_db() as session:
            recipe = session.query(SavedRecipe).filter(
                SavedRecipe.share_id == share_id
            ).first()

            if recipe:
                return recipe.get_recipe_data()
            return None

    @staticmethod
    def disable_sharing(saved_recipe_id: int, user_id: int | None = None) -> bool:
        """Disable sharing for a recipe.

        Args:
            saved_recipe_id: Saved recipe ID.
            user_id: Optional owner ID used to enforce authorization.

        Returns:
            True if successful.
        """
        with get_db() as session:
            recipe = SharingService._get_owned_recipe(session, saved_recipe_id, user_id)

            if recipe:
                recipe.share_id = None
                session.commit()
                return True
            return False
