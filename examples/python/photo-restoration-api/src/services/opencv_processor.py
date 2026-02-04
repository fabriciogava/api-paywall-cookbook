"""
OpenCV Image Processing Service

This service handles the first phase of photo restoration:
1. Edge detection to find photo boundaries
2. Perspective correction (deskewing tilted photos)
3. Auto-rotation based on orientation detection
4. Image enhancement (denoising, sharpening, contrast adjustment)

The goal is to prepare old photos that may have been:
- Photographed at an angle
- Skewed or warped
- Faded or low contrast
- Noisy or blurry
"""

import cv2
import numpy as np
from typing import Tuple, Optional
import logging

logger = logging.getLogger(__name__)


class OpenCVProcessor:
    """
    Processes images using OpenCV to prepare them for AI-based restoration.

    This class implements several computer vision techniques to automatically
    improve scanned or photographed old photos before sending them to Gemini.
    """

    def __init__(self):
        self.min_contour_area = 1000  # Minimum area for edge detection

    def _validate_image_format(self, image_bytes: bytes) -> str:
        """
        Validate image magic bytes and return format.

        Args:
            image_bytes: Raw image bytes to validate

        Returns:
            Detected image format name

        Raises:
            ValueError: If image format is not supported
        """
        ALLOWED_SIGNATURES = {
            b'\xff\xd8\xff': 'JPEG',
            b'\x89PNG\r\n\x1a\n': 'PNG',
            b'GIF87a': 'GIF',
            b'GIF89a': 'GIF',
        }

        for signature, format_name in ALLOWED_SIGNATURES.items():
            if image_bytes[:len(signature)] == signature:
                return format_name

        raise ValueError("Unsupported image format. Allowed: JPEG, PNG, GIF")

    def process_image(self, image_bytes: bytes) -> Tuple[bytes, dict]:
        """
        Main processing pipeline: takes raw image bytes, applies all enhancements,
        returns processed image bytes and metadata about what was done.

        Args:
            image_bytes: Raw image file bytes (JPEG, PNG, etc.)

        Returns:
            Tuple of (processed_image_bytes, metadata_dict)

        Raises:
            ValueError: If image cannot be decoded or format is unsupported
        """
        # Validate image format using magic bytes (security check)
        detected_format = self._validate_image_format(image_bytes)
        logger.info(f"Detected image format: {detected_format}")

        # Decode image from bytes
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("Could not decode image. Ensure it's a valid image format (JPEG, PNG, etc.)")

        logger.info(f"Processing image of size {img.shape[1]}x{img.shape[0]}")

        metadata = {
            "original_size": (img.shape[1], img.shape[0]),
            "transformations": []
        }

        # Step 1: Detect and correct perspective (if photo of a photo)
        img, perspective_corrected = self._correct_perspective(img)
        if perspective_corrected:
            metadata["transformations"].append("perspective_correction")
            logger.info("Applied perspective correction")

        # Step 2: Auto-rotate based on orientation
        img, rotation_angle = self._auto_rotate(img)
        if rotation_angle != 0:
            metadata["transformations"].append(f"rotation_{rotation_angle}deg")
            logger.info(f"Rotated image by {rotation_angle} degrees")

        # Step 3: Enhance image quality
        img = self._enhance_image(img)
        metadata["transformations"].append("enhancement")
        logger.info("Applied image enhancement")

        # Step 4: Denoise (reduce graininess in old photos)
        img = self._denoise(img)
        metadata["transformations"].append("denoising")
        logger.info("Applied denoising")

        metadata["final_size"] = (img.shape[1], img.shape[0])

        # Encode back to bytes (JPEG format)
        success, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 95])
        if not success:
            raise ValueError("Failed to encode processed image")

        return buffer.tobytes(), metadata

    def _correct_perspective(self, img: np.ndarray) -> Tuple[np.ndarray, bool]:
        """
        Detects if the photo is tilted/skewed and corrects the perspective.

        This is useful when users take a photo of a physical photo at an angle.
        We find the largest quadrilateral contour and apply perspective transform.

        Returns:
            Tuple of (corrected_image, was_corrected)
        """
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 50, 150)

        # Find contours
        contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

        # Sort by area and take the largest
        contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]

        for contour in contours:
            # Approximate the contour to a polygon
            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.02 * peri, True)

            # If we found a quadrilateral (4 corners) that's large enough
            if len(approx) == 4 and cv2.contourArea(approx) > self.min_contour_area:
                # Order points: top-left, top-right, bottom-right, bottom-left
                pts = approx.reshape(4, 2)
                rect = self._order_points(pts)

                # Check if the quad is significantly skewed
                # If all corners are near the image edges, skip transformation
                h, w = img.shape[:2]
                margin = 0.05  # 5% margin
                is_near_edge = all([
                    (rect[0][0] < w * margin and rect[0][1] < h * margin),  # top-left
                    (rect[1][0] > w * (1-margin) and rect[1][1] < h * margin),  # top-right
                    (rect[2][0] > w * (1-margin) and rect[2][1] > h * (1-margin)),  # bottom-right
                    (rect[3][0] < w * margin and rect[3][1] > h * (1-margin))  # bottom-left
                ])

                if is_near_edge:
                    # Photo is already aligned, skip transformation
                    continue

                # Compute the width and height of the new image
                (tl, tr, br, bl) = rect
                widthA = np.linalg.norm(br - bl)
                widthB = np.linalg.norm(tr - tl)
                maxWidth = max(int(widthA), int(widthB))

                heightA = np.linalg.norm(tr - br)
                heightB = np.linalg.norm(tl - bl)
                maxHeight = max(int(heightA), int(heightB))

                # Validate dimensions to prevent zero-dimension output (degenerate quadrilaterals)
                if maxWidth <= 0 or maxHeight <= 0:
                    logger.warning(
                        f"Invalid dimensions from contour: {maxWidth}x{maxHeight}, "
                        f"skipping this contour"
                    )
                    continue  # Skip this contour, try next

                # Destination points for the transform
                dst = np.array([
                    [0, 0],
                    [maxWidth - 1, 0],
                    [maxWidth - 1, maxHeight - 1],
                    [0, maxHeight - 1]
                ], dtype="float32")

                # Apply perspective transform
                M = cv2.getPerspectiveTransform(rect, dst)
                warped = cv2.warpPerspective(img, M, (maxWidth, maxHeight))

                return warped, True

        # No perspective correction needed or detected
        return img, False

    def _order_points(self, pts: np.ndarray) -> np.ndarray:
        """
        Orders points in clockwise order: top-left, top-right, bottom-right, bottom-left.
        """
        rect = np.zeros((4, 2), dtype="float32")

        # Sum of coordinates: top-left has smallest sum, bottom-right has largest
        s = pts.sum(axis=1)
        rect[0] = pts[np.argmin(s)]
        rect[2] = pts[np.argmax(s)]

        # Difference: top-right has smallest diff, bottom-left has largest
        diff = np.diff(pts, axis=1)
        rect[1] = pts[np.argmin(diff)]
        rect[3] = pts[np.argmax(diff)]

        return rect

    def _auto_rotate(self, img: np.ndarray) -> Tuple[np.ndarray, int]:
        """
        Detects image orientation and rotates to correct position.

        Uses Hough Line Transform to detect dominant line angles.
        If most lines are horizontal/vertical, the image is properly oriented.
        Otherwise, we rotate to align them.

        Returns:
            Tuple of (rotated_image, rotation_angle)
        """
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)

        # Detect lines using Hough Transform
        lines = cv2.HoughLines(edges, 1, np.pi / 180, 200)

        if lines is None or len(lines) < 5:
            # Not enough lines to determine orientation
            return img, 0

        # Calculate median angle of detected lines
        angles = []
        for rho, theta in lines[:, 0]:
            angle = np.degrees(theta)
            # Convert to -90 to 90 range
            if angle > 90:
                angle = angle - 180
            angles.append(angle)

        median_angle = np.median(angles)

        # If median angle is close to 0, 90, or -90, image is aligned
        # Otherwise, rotate to nearest cardinal direction
        if abs(median_angle) < 5:
            rotation_angle = 0
        elif abs(median_angle - 90) < 5:
            rotation_angle = 0  # Already vertical
        elif abs(median_angle + 90) < 5:
            rotation_angle = 0  # Already vertical (other way)
        elif 40 < median_angle < 50:
            rotation_angle = 90
        elif -50 < median_angle < -40:
            rotation_angle = -90
        else:
            # Round to nearest 90 degrees
            rotation_angle = int(round(median_angle / 90.0)) * 90

        if rotation_angle == 0:
            return img, 0

        # Rotate the image
        h, w = img.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, rotation_angle, 1.0)

        # Calculate new bounding dimensions
        cos = np.abs(M[0, 0])
        sin = np.abs(M[0, 1])
        new_w = int((h * sin) + (w * cos))
        new_h = int((h * cos) + (w * sin))

        # Adjust rotation matrix for new dimensions
        M[0, 2] += (new_w / 2) - center[0]
        M[1, 2] += (new_h / 2) - center[1]

        rotated = cv2.warpAffine(img, M, (new_w, new_h),
                                  flags=cv2.INTER_CUBIC,
                                  borderMode=cv2.BORDER_REPLICATE)

        return rotated, rotation_angle

    def _enhance_image(self, img: np.ndarray) -> np.ndarray:
        """
        Enhances image quality by adjusting contrast, brightness, and sharpness.

        Uses CLAHE (Contrast Limited Adaptive Histogram Equalization) to improve
        local contrast without over-amplifying noise.
        """
        # Convert to LAB color space (better for contrast adjustment)
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)

        # Apply CLAHE to L channel (lightness)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)

        # Merge channels
        enhanced_lab = cv2.merge([l, a, b])
        enhanced = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)

        # Apply unsharp masking for sharpness
        gaussian = cv2.GaussianBlur(enhanced, (0, 0), 2.0)
        enhanced = cv2.addWeighted(enhanced, 1.5, gaussian, -0.5, 0)

        return enhanced

    def _denoise(self, img: np.ndarray) -> np.ndarray:
        """
        Reduces noise while preserving edges using Non-Local Means Denoising.

        This is particularly effective for scanned photos with grain or sensor noise.
        """
        # fastNlMeansDenoisingColored is optimized for color images
        # Parameters: (src, h, hColor, templateWindowSize, searchWindowSize)
        # h: filter strength (higher = more denoising but more blur)
        # hColor: same for color components
        denoised = cv2.fastNlMeansDenoisingColored(img, None, 10, 10, 7, 21)
        return denoised
