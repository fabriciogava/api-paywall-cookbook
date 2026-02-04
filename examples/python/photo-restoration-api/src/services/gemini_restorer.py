"""
Gemini AI Restoration Service

This service handles the second phase of photo restoration using Google's Gemini AI.
It takes the preprocessed image from OpenCV and uses Gemini's vision capabilities
to restore, colorize, and enhance old photographs.

The Gemini model can:
- Colorize black and white photos
- Remove scratches and damage
- Restore faded colors
- Enhance facial details
- Upscale resolution while maintaining quality
"""

import base64
import logging
from typing import Optional
from google import genai
from PIL import Image
import io

logger = logging.getLogger(__name__)


class GeminiRestorer:
    """
    Uses Google's Gemini AI to restore and colorize old photographs.

    This class leverages Gemini's vision capabilities to understand the content
    of old photos and intelligently restore them with realistic colors and details.
    """

    def __init__(self, api_key: str):
        """
        Initialize the Gemini restoration service.

        Args:
            api_key: Google AI API key for Gemini access

        Raises:
            ValueError: If API key is not provided
        """
        if not api_key:
            raise ValueError("Gemini API key is required")

        self.api_key = api_key

        # Create client with explicit API key
        # The new SDK uses a centralized Client object as entry point
        self.client = genai.Client(api_key=api_key)

        # Model name for image generation/restoration
        # Gemini 2.5 Flash Image (Nano Banana) - optimized for image generation
        # This model can actually restore, colorize, and enhance photos
        self.model_name = 'gemini-2.5-flash-image'

        logger.info(f"Gemini restorer initialized with model: {self.model_name}")

    def restore_and_colorize(self, image_bytes: bytes) -> tuple[bytes, dict]:
        """
        Restores and colorizes an old photograph using Gemini AI image generation.

        Args:
            image_bytes: Preprocessed image bytes from OpenCV

        Returns:
            Tuple of (restored_image_bytes, metadata_dict)

        Raises:
            Exception: If Gemini API call fails or no image is generated
        """
        logger.info("Starting Gemini image restoration process")

        # Load image with PIL for Gemini
        image = Image.open(io.BytesIO(image_bytes))

        # Prepare the restoration prompt for image generation
        # This instructs Gemini to generate a restored version of the photo
        prompt = """Restore and enhance this old photograph. Apply professional photo restoration techniques:

1. **Colorization**: If black and white, add realistic, period-appropriate colors based on the subject matter and era
2. **Damage repair**: Remove scratches, tears, stains, spots, and other physical damage
3. **Quality enhancement**: Improve sharpness, clarity, and detail while maintaining natural appearance
4. **Color restoration**: If faded, restore vibrant, accurate colors
5. **Lighting balance**: Optimize contrast, brightness, and exposure
6. **Preservation**: Maintain the authentic character and composition of the original photograph

Generate a professionally restored version of this image that looks natural and historically accurate."""

        try:
            # Generate restored image using Gemini's image generation capabilities
            # The new SDK returns generated images in response.parts
            # Note: Timeout is handled at the HTTP client level, not in GenerateContentConfig
            from google.genai import types

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[image, prompt],
                config=types.GenerateContentConfig(
                    temperature=0.4
                )
            )

            if not response or not response.parts:
                raise Exception("Gemini returned empty response with no generated content")

            # Extract the generated image from response parts
            # Gemini image generation returns images in inline_data
            restored_image = None
            generation_info = None

            for part in response.parts:
                if part.inline_data:
                    # This part contains the generated image
                    # Load the raw bytes into PIL directly (as_image() returns SDK object, not PIL)
                    try:
                        image_data = part.inline_data.data
                        restored_image = Image.open(io.BytesIO(image_data))
                        logger.info("Successfully extracted restored image from Gemini response")
                        break
                    except Exception as img_err:
                        logger.warning(f"Failed to extract image from part: {img_err}")
                        continue  # Try next part
                elif part.text:
                    # Some models may also return text explanation
                    generation_info = part.text

            if not restored_image:
                raise Exception("Gemini did not generate any images in the response")

            # Convert PIL Image to bytes
            output = io.BytesIO()
            restored_image.save(output, format='JPEG', quality=95)
            restored_bytes = output.getvalue()

            # Build metadata
            metadata = {
                "service": self.model_name,
                "sdk": "google-genai",
                "restoration_type": "ai_generated",
                "original_size": image.size,
                "restored_size": restored_image.size,
                "output_format": "JPEG",
                "quality": 95,
            }

            # Add generation info if provided
            if generation_info:
                metadata["generation_notes"] = generation_info

            logger.info(f"Image restoration completed: {image.size} -> {restored_image.size}")

            return restored_bytes, metadata

        except Exception as e:
            logger.error(f"Gemini restoration failed: {str(e)}")
            raise Exception(f"Failed to restore image with Gemini: {str(e)}")

    def get_restoration_instructions(self, image_bytes: bytes) -> str:
        """
        Gets detailed restoration instructions from Gemini without modifying the image.

        This is useful for users who want guidance on how to manually restore their photos
        or for understanding what the AI restoration will do.

        Note: Uses the same model but requests text analysis instead of image generation.

        Args:
            image_bytes: Image to analyze

        Returns:
            Detailed restoration instructions as text
        """
        try:
            image = Image.open(io.BytesIO(image_bytes))

            prompt = """As a professional photo restorer, analyze this photograph and provide step-by-step restoration recommendations.

Include:
1. What era/period does this photo appear to be from?
2. Current condition assessment (damage, fading, quality issues)
3. Recommended colorization approach (if black and white)
4. Specific repair techniques needed for damage
5. Color palette suggestions (if applicable)
6. Priority order for restoration steps

Provide a detailed, actionable analysis in text format."""

            # Use new SDK API: client.models.generate_content()
            # Request text response rather than image generation
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[image, prompt]
            )

            # Extract text from response
            if not response or not response.text:
                return "Unable to generate restoration instructions"

            return response.text

        except Exception as e:
            logger.error(f"Failed to get restoration instructions: {str(e)}")
            return f"Error generating instructions: {str(e)}"


# Implementation Note:
#
# This service now uses Gemini 2.5 Flash Image (gemini-2.5-flash-image) which natively
# supports image generation and editing. The model can:
#
# 1. **Restore damaged photos**: Remove scratches, tears, stains
# 2. **Colorize B&W photos**: Add realistic, period-appropriate colors
# 3. **Enhance quality**: Improve sharpness, clarity, and detail
# 4. **Restore faded colors**: Bring vibrancy back to old color photos
# 5. **Optimize lighting**: Balance contrast and exposure
#
# The generated images include SynthID watermarks for authenticity verification.
#
# Alternative/Complementary approaches:
#
# 1. **Specialized open-source models** (for additional processing):
#    - DeOldify: Advanced colorization
#    - Real-ESRGAN: Super-resolution upscaling
#    - GFPGAN: Face-specific restoration
#    - CodeFormer: Robust face restoration
#
# 2. **Hybrid approach** (recommended for production):
#    - Use OpenCV for preprocessing (implemented in opencv_processor.py)
#    - Use Gemini for AI-powered restoration (this service)
#    - Optionally apply additional specialized models for specific enhancements
#
# The current implementation leverages Gemini's native image generation capabilities,
# making it a complete, production-ready photo restoration service.
