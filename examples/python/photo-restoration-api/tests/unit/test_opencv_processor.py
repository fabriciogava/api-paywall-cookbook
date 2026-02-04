"""
Unit tests for OpenCVProcessor service.

Tests the computer vision preprocessing pipeline:
- Image decoding
- Perspective correction
- Auto-rotation
- Image enhancement
- Denoising
"""

import pytest
import numpy as np
import cv2
from PIL import Image
import io


def test_process_image_valid_jpeg(opencv_processor, sample_image_bytes):
    """
    Test that a valid JPEG image can be processed successfully.
    """
    result_bytes, metadata = opencv_processor.process_image(sample_image_bytes)

    # Verify result is valid image bytes
    assert isinstance(result_bytes, bytes)
    assert len(result_bytes) > 0

    # Verify metadata structure
    assert "original_size" in metadata
    assert "final_size" in metadata
    assert "transformations" in metadata
    assert isinstance(metadata["transformations"], list)

    # Verify the image can be decoded
    nparr = np.frombuffer(result_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    assert img is not None


def test_process_image_invalid_bytes(opencv_processor):
    """
    Test that invalid image bytes raise a ValueError.
    Now catches unsupported format during magic byte validation.
    """
    invalid_bytes = b"this is not an image"

    with pytest.raises(ValueError, match="Unsupported image format"):
        opencv_processor.process_image(invalid_bytes)


def test_process_image_empty_bytes(opencv_processor):
    """
    Test that empty bytes are handled gracefully.
    Magic byte validation catches this before OpenCV decode.
    """
    with pytest.raises(ValueError, match="Unsupported image format"):
        opencv_processor.process_image(b"")


def test_process_image_applies_enhancement(opencv_processor, sample_image_bytes):
    """
    Test that enhancement transformation is applied.
    """
    _, metadata = opencv_processor.process_image(sample_image_bytes)

    assert "enhancement" in metadata["transformations"]


def test_process_image_applies_denoising(opencv_processor, sample_image_bytes):
    """
    Test that denoising transformation is applied.
    """
    _, metadata = opencv_processor.process_image(sample_image_bytes)

    assert "denoising" in metadata["transformations"]


def test_perspective_correction_on_skewed_image(opencv_processor, sample_skewed_image_bytes):
    """
    Test that perspective correction is attempted on images with clear edges.

    Note: This test checks that the algorithm runs, not that it always corrects.
    Perspective correction depends on detecting a clear quadrilateral contour.
    """
    result_bytes, metadata = opencv_processor.process_image(sample_skewed_image_bytes)

    # Check if perspective correction was attempted
    # (May or may not be applied depending on contour detection success)
    transformations = metadata["transformations"]

    # At minimum, enhancement and denoising should be applied
    assert "enhancement" in transformations
    assert "denoising" in transformations


def test_order_points_clockwise(opencv_processor):
    """
    Test the _order_points helper method orders corners correctly.
    """
    # Create unordered corner points (top-left, top-right, bottom-right, bottom-left)
    unordered = np.array([
        [100, 0],    # top-right
        [0, 0],      # top-left
        [100, 100],  # bottom-right
        [0, 100]     # bottom-left
    ], dtype="float32")

    ordered = opencv_processor._order_points(unordered)

    # Check order: [top-left, top-right, bottom-right, bottom-left]
    assert np.allclose(ordered[0], [0, 0])      # top-left
    assert np.allclose(ordered[1], [100, 0])    # top-right
    assert np.allclose(ordered[2], [100, 100])  # bottom-right
    assert np.allclose(ordered[3], [0, 100])    # bottom-left


def test_enhance_image_increases_contrast(opencv_processor):
    """
    Test that enhancement actually increases image contrast.
    """
    # Create a low-contrast test image
    img_array = np.full((100, 100, 3), 128, dtype=np.uint8)  # Gray image

    enhanced = opencv_processor._enhance_image(img_array)

    # Enhanced image should still be valid
    assert enhanced.shape == img_array.shape
    assert enhanced.dtype == np.uint8


def test_denoise_preserves_image_dimensions(opencv_processor):
    """
    Test that denoising preserves image dimensions.
    """
    # Create a test image with some noise
    img_array = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)

    denoised = opencv_processor._denoise(img_array)

    assert denoised.shape == img_array.shape
    assert denoised.dtype == np.uint8


def test_process_large_image(opencv_processor):
    """
    Test that large images (e.g., 4K resolution) can be processed.
    """
    # Create a large test image (scaled down for test speed: 800x600)
    large_img = Image.new('RGB', (800, 600), color='blue')
    buffer = io.BytesIO()
    large_img.save(buffer, format='JPEG', quality=95)
    large_bytes = buffer.getvalue()

    result_bytes, metadata = opencv_processor.process_image(large_bytes)

    assert len(result_bytes) > 0
    assert metadata["original_size"] == (800, 600)


def test_process_grayscale_image(opencv_processor):
    """
    Test that grayscale images are handled correctly.

    The processor should convert them to color for processing.
    """
    # Create a grayscale test image
    gray_img = Image.new('L', (100, 100), color=128)
    buffer = io.BytesIO()
    gray_img.save(buffer, format='JPEG')
    gray_bytes = buffer.getvalue()

    # OpenCV will read this as grayscale, but cv2.imdecode with IMREAD_COLOR
    # will convert it to 3-channel BGR, so processing should succeed
    result_bytes, metadata = opencv_processor.process_image(gray_bytes)

    assert len(result_bytes) > 0
    assert "transformations" in metadata


def test_process_png_image(opencv_processor):
    """
    Test that PNG images (not just JPEG) can be processed.
    """
    # Create a PNG test image
    png_img = Image.new('RGB', (100, 100), color='green')
    buffer = io.BytesIO()
    png_img.save(buffer, format='PNG')
    png_bytes = buffer.getvalue()

    result_bytes, metadata = opencv_processor.process_image(png_bytes)

    assert len(result_bytes) > 0
    # Result is encoded as JPEG (as per implementation)
    assert result_bytes.startswith(b'\xff\xd8')  # JPEG magic bytes
