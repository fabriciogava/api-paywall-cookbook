"""
Unit tests for GeminiRestorer service.

Tests the AI restoration analysis using Google Gemini.
Uses mocking to avoid actual API calls.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import io
from PIL import Image


def test_gemini_restorer_initialization():
    """
    Test that GeminiRestorer initializes correctly with an API key.
    Updated for new google.genai SDK.
    """
    with patch('services.gemini_restorer.genai.Client') as mock_client_class:
        from services.gemini_restorer import GeminiRestorer

        restorer = GeminiRestorer(api_key="test_key_12345")

        # Verify genai.Client was called with the API key
        mock_client_class.assert_called_once_with(api_key="test_key_12345")


def test_gemini_restorer_requires_api_key():
    """
    Test that GeminiRestorer raises ValueError if no API key provided.
    """
    from services.gemini_restorer import GeminiRestorer

    with pytest.raises(ValueError, match="API key is required"):
        GeminiRestorer(api_key="")

    with pytest.raises(ValueError, match="API key is required"):
        GeminiRestorer(api_key=None)


def test_restore_and_colorize_success(mock_gemini_restorer, sample_image_bytes):
    """
    Test successful image restoration with mocked Gemini image generation response.
    """
    result_bytes, metadata = mock_gemini_restorer.restore_and_colorize(sample_image_bytes)

    # Verify result
    assert isinstance(result_bytes, bytes)
    assert len(result_bytes) > 0

    # Verify metadata structure for image generation
    assert "service" in metadata
    assert metadata["service"] == "gemini-2.5-flash-image"
    assert "restoration_type" in metadata
    assert metadata["restoration_type"] == "ai_generated"
    assert "original_size" in metadata
    assert "restored_size" in metadata

    # Verify sizes are tuples
    assert isinstance(metadata["original_size"], tuple)
    assert isinstance(metadata["restored_size"], tuple)


def test_restore_and_colorize_with_invalid_image(mock_gemini_restorer):
    """
    Test that invalid image bytes are handled gracefully.
    """
    invalid_bytes = b"not an image"

    # PIL should raise an exception when trying to open invalid image
    with pytest.raises(Exception):
        mock_gemini_restorer.restore_and_colorize(invalid_bytes)


def test_get_restoration_instructions_success(sample_image_bytes):
    """
    Test getting restoration instructions without modifying the image.
    This method returns text analysis, not generated images.
    """
    with patch('services.gemini_restorer.genai.Client') as mock_client_class:
        from services.gemini_restorer import GeminiRestorer

        # Mock text response for instructions
        mock_response = Mock(
            text="Professional restoration analysis: This photo requires colorization and damage repair."
        )
        mock_client = Mock()
        mock_models = Mock()
        mock_models.generate_content = Mock(return_value=mock_response)
        mock_client.models = mock_models
        mock_client_class.return_value = mock_client

        restorer = GeminiRestorer(api_key="test_key")
        instructions = restorer.get_restoration_instructions(sample_image_bytes)

        assert isinstance(instructions, str)
        assert len(instructions) > 0
        # Should contain actionable guidance
        assert any(word in instructions.lower() for word in ["restoration", "colorization", "repair"])


def test_get_restoration_instructions_with_invalid_image(mock_gemini_restorer):
    """
    Test that invalid images return error message instead of crashing.
    """
    invalid_bytes = b"not an image"

    # Should handle error gracefully and return error string
    result = mock_gemini_restorer.get_restoration_instructions(invalid_bytes)

    assert isinstance(result, str)
    # Error message should be returned (not an exception raised)


@patch('services.gemini_restorer.genai.Client')
def test_restore_and_colorize_api_failure(mock_client_class, sample_image_bytes):
    """
    Test handling of Gemini API failures.
    Updated for new google.genai SDK.
    """
    from services.gemini_restorer import GeminiRestorer

    # Mock the client to raise an exception
    mock_client = Mock()
    mock_models = Mock()
    mock_models.generate_content = Mock(side_effect=Exception("API rate limit exceeded"))
    mock_client.models = mock_models
    mock_client_class.return_value = mock_client

    restorer = GeminiRestorer(api_key="test_key")

    # Should raise exception with helpful message
    with pytest.raises(Exception, match="Failed to restore image with Gemini"):
        restorer.restore_and_colorize(sample_image_bytes)


@patch('services.gemini_restorer.genai.Client')
def test_restore_and_colorize_empty_response(mock_client_class, sample_image_bytes):
    """
    Test handling when Gemini returns empty response with no parts.
    Updated for new google.genai SDK and image generation.
    """
    from services.gemini_restorer import GeminiRestorer

    # Mock empty response (no parts)
    mock_response = Mock(parts=None)
    mock_client = Mock()
    mock_models = Mock()
    mock_models.generate_content = Mock(return_value=mock_response)
    mock_client.models = mock_models
    mock_client_class.return_value = mock_client

    restorer = GeminiRestorer(api_key="test_key")

    with pytest.raises(Exception, match="Gemini returned empty response"):
        restorer.restore_and_colorize(sample_image_bytes)


@patch('services.gemini_restorer.genai.Client')
def test_restore_and_colorize_no_image_generated(mock_client_class, sample_image_bytes):
    """
    Test handling when Gemini returns parts but no image (only text).
    """
    from services.gemini_restorer import GeminiRestorer

    # Mock response with only text part, no image
    mock_text_part = Mock()
    mock_text_part.inline_data = None
    mock_text_part.text = "Some text response"

    mock_response = Mock(parts=[mock_text_part])
    mock_client = Mock()
    mock_models = Mock()
    mock_models.generate_content = Mock(return_value=mock_response)
    mock_client.models = mock_models
    mock_client_class.return_value = mock_client

    restorer = GeminiRestorer(api_key="test_key")

    with pytest.raises(Exception, match="did not generate any images"):
        restorer.restore_and_colorize(sample_image_bytes)


def test_restoration_metadata_structure(mock_gemini_restorer, sample_image_bytes):
    """
    Test that restoration metadata includes expected fields for image generation.
    """
    _, metadata = mock_gemini_restorer.restore_and_colorize(sample_image_bytes)

    # Check for required metadata fields
    assert "service" in metadata
    assert "sdk" in metadata
    assert "restoration_type" in metadata
    assert "original_size" in metadata
    assert "restored_size" in metadata
    assert "output_format" in metadata
    assert "quality" in metadata

    # Verify values
    assert metadata["sdk"] == "google-genai"
    assert metadata["output_format"] == "JPEG"
    assert metadata["quality"] == 95


def test_restorer_uses_correct_model(mock_gemini_restorer, sample_image_bytes):
    """
    Test that the restorer is configured to use the correct Gemini model.
    """
    # Check that the model name is set correctly
    # We now use gemini-2.5-flash-image for actual image generation
    # The actual model initialization is mocked, so we verify the expected model name
    # is referenced in the code

    # We can check this through the metadata returned
    result_bytes, metadata = mock_gemini_restorer.restore_and_colorize(sample_image_bytes)

    assert metadata["service"] == "gemini-2.5-flash-image"
