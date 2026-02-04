"""
Photo Restoration API - Core Application

This is the platform-agnostic core of the Photo Restoration API.
It follows the Factory Pattern to separate "what runs" from "where it runs".

The application uses:
- FastAPI for the web framework (async, type-safe, OpenAPI docs)
- x402 v2 Python SDK for payment handling
- SKALE network for low-cost, fast blockchain payments
- OpenCV for image preprocessing
- Google Gemini for AI-powered restoration analysis

Architecture:
1. User uploads old photo
2. OpenCV preprocesses (perspective correction, enhancement, denoising)
3. Gemini AI generates restored/colorized version using image generation
4. Return the AI-restored image with metadata

Payment: Fixed price of 0.10 USDC on SKALE mainnet
"""

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field
from typing import Optional, Callable
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send
import logging
import base64
import asyncio
import traceback
import sys
import httpx

# x402 v2 SDK imports - Official middleware pattern
from x402.http import HTTPFacilitatorClient, FacilitatorConfig, PaymentOption
from x402.http.middleware.fastapi import PaymentMiddlewareASGI
from x402.http.types import RouteConfig
from x402.server import x402ResourceServer
from x402.mechanisms.evm.exact import ExactEvmServerScheme
from x402.mechanisms.evm import utils as evm_utils

def fetch_network_config_from_facilitator(facilitator_url: str, network_id: str, asset_address: str) -> dict | None:
    """
    Fetch network/asset configuration from the Kobaru facilitator.
    This ensures we use the exact token name expected by the facilitator for EIP-712 signatures.

    Args:
        facilitator_url: URL of the facilitator (e.g., https://gateway.kobaru.io)
        network_id: Network ID in CAIP-2 format (e.g., eip155:1187947933)
        asset_address: Token contract address to look up

    Returns:
        Asset configuration dict with address, name, version, decimals, or None if not found
    """
    import httpx

    try:
        response = httpx.get(f"{facilitator_url}/supported", timeout=10.0)
        if response.status_code != 200:
            logger.warning(f"Failed to fetch facilitator config: {response.status_code}")
            return None

        data = response.json()

        # Find the network and asset in the supported list
        # Note: Facilitator returns "kinds" array, not "accepts"
        for item in data.get("kinds", []):
            if item.get("network") == network_id:
                extra = item.get("extra", {})
                # Verify asset address matches
                if extra.get("asset", "").lower() == asset_address.lower():
                    return {
                        "address": extra.get("asset"),
                        "name": extra.get("name"),
                        "version": extra.get("version", "2"),
                        "decimals": extra.get("decimals", 6),
                    }

        logger.warning(f"Network {network_id} with asset {asset_address} not found in facilitator")
        return None

    except Exception as e:
        logger.warning(f"Error fetching facilitator config: {e}")
        return None


def setup_network_config(facilitator_url: str, network_id: str, asset_address: str) -> None:
    """
    Configure the x402 SDK for the specified network.
    Fetches token metadata from facilitator to ensure EIP-712 signature compatibility.

    Args:
        facilitator_url: URL of the facilitator
        network_id: Network ID in CAIP-2 format (e.g., eip155:1187947933)
        asset_address: Token contract address
    """
    # Extract chain ID from network ID (e.g., "eip155:1187947933" -> 1187947933)
    try:
        chain_id = int(network_id.split(":")[1])
    except (IndexError, ValueError):
        raise ValueError(f"Invalid network ID format: {network_id}. Expected CAIP-2 format (e.g., eip155:1187947933)")

    # Check if network is already configured in x402
    if network_id in evm_utils.NETWORK_CONFIGS:
        logger.info(f"Network {network_id} already configured in x402 SDK")
        return

    # Fetch config from facilitator
    asset_config = fetch_network_config_from_facilitator(facilitator_url, network_id, asset_address)

    if asset_config:
        network_config = {
            "chain_id": chain_id,
            "default_asset": asset_config,
            "supported_assets": {"USDC": asset_config},
        }
        evm_utils.NETWORK_CONFIGS[network_id] = network_config
        logger.info(f"Added network config from facilitator: {network_id} ({asset_config['name']})")
    else:
        # Fallback: use provided asset address with generic name
        logger.warning(f"Using fallback config for {network_id} (facilitator lookup failed)")
        fallback_config = {
            "address": asset_address,
            "name": "USDC",  # Generic fallback - may cause signature issues
            "version": "2",
            "decimals": 6,
        }
        network_config = {
            "chain_id": chain_id,
            "default_asset": fallback_config,
            "supported_assets": {"USDC": fallback_config},
        }
        evm_utils.NETWORK_CONFIGS[network_id] = network_config
        logger.warning("Fallback config may cause EIP-712 signature verification failures")

# Our service imports
from services.opencv_processor import OpenCVProcessor
from services.gemini_restorer import GeminiRestorer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ErrorLoggingMiddleware:
    """
    Pure ASGI middleware that catches and logs exceptions gracefully.
    Handles payment verification failures as expected errors (403).
    Logs unexpected errors with full traceback (500).
    """
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "UNKNOWN")
        path = scope.get("path", "UNKNOWN")

        # Capture response status for logging
        status_code = [200]

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status_code[0] = message.get("status", 200)
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as exc:
            import json
            exc_str = str(exc).lower()

            # Check if this is a payment verification failure (expected error, handle gracefully)
            if "facilitator" in exc_str and ("verify" in exc_str or "invalid" in exc_str):
                # Extract reason from exception message
                error_detail = str(exc)
                reason = "payment_verification_failed"
                if "{" in error_detail:
                    try:
                        json_part = error_detail[error_detail.index("{"):error_detail.rindex("}")+1]
                        parsed = json.loads(json_part)
                        reason = parsed.get("invalidReason", reason)
                    except:
                        pass

                # Log concisely (not full traceback - this is an expected error)
                logger.warning(f"Payment verification failed for {method} {path}: {reason}")

                await send({
                    "type": "http.response.start",
                    "status": 403,
                    "headers": [[b"content-type", b"application/json"]],
                })
                await send({
                    "type": "http.response.body",
                    "body": json.dumps({
                        "error": "Payment verification failed",
                        "reason": reason,
                        "message": "The payment signature could not be verified. Please ensure you're using the correct network and have sufficient funds."
                    }).encode(),
                })
            else:
                # Unexpected error - log full traceback and return 500
                err_msg = f"[ERROR] {type(exc).__name__}: {str(exc)} for {method} {path}"
                print(err_msg, flush=True)
                traceback.print_exc()

                await send({
                    "type": "http.response.start",
                    "status": 500,
                    "headers": [[b"content-type", b"application/json"]],
                })
                await send({
                    "type": "http.response.body",
                    "body": json.dumps({
                        "error": "Internal server error",
                        "detail": str(exc)
                    }).encode(),
                })


# Configuration interface - platform agnostic
class AppConfig(BaseModel):
    """
    Application configuration.
    Platform adapters (deploy/standalone) will load environment variables
    and build this config object.
    """
    wallet_address: str  # Payment destination wallet
    facilitator_url: str = "https://gateway.kobaru.io"
    gemini_api_key: str
    kobaru_api_key: Optional[str] = None  # Optional premium features
    restoration_price: str = "$0.10"  # Price per restoration
    network_id: str = "eip155:1187947933"  # Blockchain network (CAIP-2 format)
    asset_address: str = "0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20"  # Token address


# Request model for photo restoration
class RestoreRequest(BaseModel):
    """
    Request model for the /restore endpoint.
    Accepts base64-encoded image data in JSON format.
    """
    image: str = Field(
        ...,
        description="Base64-encoded image data (JPEG, PNG, etc.)",
        min_length=100,  # Minimum size for a valid image
        max_length=50_000_000  # ~37MB decoded (reasonable limit for photos)
    )
    filename: Optional[str] = Field(
        default="image.jpg",
        description="Optional filename for the image"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "image": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD...",
                "filename": "old-family-photo.jpg"
            }
        }


async def create_app(config: AppConfig) -> FastAPI:
    """
    Factory function that creates and configures the FastAPI application.

    This follows the Factory Pattern - it's platform-agnostic and testable.
    No direct environment variable access here; that happens in deploy adapters.

    Args:
        config: Application configuration

    Returns:
        Configured FastAPI application

    Raises:
        ValueError: If configuration is invalid
        Exception: If facilitator connection fails
    """
    logger.info("Creating Photo Restoration API...")

    # 1. Initialize FastAPI
    app = FastAPI(
        title="Photo Restoration API",
        description="Restore and colorize old photographs using AI and computer vision. Powered by x402 payments on SKALE.",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc"
    )

    # Pydantic validation error handler
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """
        Handle Pydantic validation errors with detailed logging.
        """
        logger.error(f"Validation error in {request.method} {request.url.path}")
        logger.error(f"Validation errors: {exc.errors()}")
        logger.error(f"Request body preview: {str(exc.body)[:200] if exc.body else 'No body'}")

        return JSONResponse(
            status_code=422,
            content={
                "error": "Validation error",
                "detail": exc.errors(),
            }
        )

    # Global exception handler to log all unhandled exceptions
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        """
        Catch-all exception handler that logs full stack traces.
        This ensures we never get silent 500 errors.
        """
        logger.error(f"Unhandled exception in {request.method} {request.url.path}")
        logger.error(f"Exception type: {type(exc).__name__}")
        logger.error(f"Exception message: {str(exc)}")
        logger.error(f"Full traceback:\n{''.join(traceback.format_exception(type(exc), exc, exc.__traceback__))}")

        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal server error",
                "detail": str(exc),
                "type": type(exc).__name__
            }
        )

    # 2. Security & CORS
    # Allow all origins since this is a public paid API
    # Access control is enforced via payments, not CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # NOTE: ErrorLoggingMiddleware will be added AFTER PaymentMiddlewareASGI
    # to ensure it wraps x402 and catches its exceptions

    # 3. Initialize Services
    opencv_processor = OpenCVProcessor()
    gemini_restorer = GeminiRestorer(api_key=config.gemini_api_key)

    logger.info("Services initialized: OpenCV processor and Gemini restorer ready")

    # 4. Setup x402 Payment System (Official Pattern)

    # Configure network in x402 SDK (fetches token metadata from facilitator)
    setup_network_config(config.facilitator_url, config.network_id, config.asset_address)

    # Create facilitator client with custom httpx client that has proper timeout/keepalive settings
    # This prevents stale connections from causing settlement failures after long Gemini processing
    http_client = httpx.AsyncClient(
        timeout=30.0,
        limits=httpx.Limits(
            max_keepalive_connections=0,  # Disable keepalive to prevent stale connections
            max_connections=10,
        ),
    )
    facilitator = HTTPFacilitatorClient(
        FacilitatorConfig(url=config.facilitator_url, http_client=http_client)
    )

    # Add authentication if Kobaru API key is provided (for premium features)
    if config.kobaru_api_key:
        async def create_auth_headers():
            headers = {"x-api-key": config.kobaru_api_key}
            return {
                "supported": headers,
                "verify": headers,
                "settle": headers,
            }
        facilitator.create_auth_headers = create_auth_headers
        logger.info("Kobaru API key configured for premium features")

    # Create resource server and register payment scheme
    server = x402ResourceServer(facilitator)
    server.register(config.network_id, ExactEvmServerScheme())
    logger.info(f"Registered ExactEvmScheme for network: {config.network_id}")

    # Add settlement failure hook for debugging intermittent issues
    def on_settle_failure(context):
        logger.error(f"Settlement failure detected!")
        logger.error(f"  Error type: {type(context.error).__name__}")
        logger.error(f"  Error message: {context.error}")
        logger.error(f"  Payload scheme: {context.payment_payload.get_scheme() if context.payment_payload else 'N/A'}")
        logger.error(f"  Payload network: {context.payment_payload.get_network() if context.payment_payload else 'N/A'}")
        return None  # Don't recover, just log

    server.on_settle_failure(on_settle_failure)

    # 5. Define Payment Routes
    routes = {
        "POST /restore": RouteConfig(
            accepts=[
                PaymentOption(
                    scheme="exact",
                    pay_to=config.wallet_address,
                    price=config.restoration_price,
                    network=config.network_id,
                )
            ]
        )
    }

    logger.info(f"Payment routes configured: POST /restore requires {config.restoration_price}")
    logger.info(f"Accepting payments on {config.network_id} to wallet: {config.wallet_address}")

    # 6. Define Route Handlers

    @app.get("/")
    async def root():
        """
        API introduction - Free endpoint.

        Provides information about the API and available endpoints.
        """
        return {
            "name": "Photo Restoration API",
            "description": "Restore and colorize your old photographs using AI-powered computer vision",
            "tagline": "Bringing memories back to life, one photo at a time",
            "features": [
                "Automatic perspective correction for tilted photos",
                "Edge detection and cropping",
                "Noise reduction and image enhancement",
                "AI-powered photo restoration and colorization via Gemini 2.5 Flash Image",
                "Damage repair (scratches, tears, stains removal)",
                "Black and white photo colorization with period-appropriate colors",
                "Support for JPEG, PNG, and other common formats"
            ],
            "pricing": {
                "restoration": config.restoration_price,
                "payment_network": "SKALE (eip155:1187947933)",
                "payment_token": "USDC"
            },
            "endpoints": {
                "/": "This introduction (free)",
                "/health": "Health check (free)",
                "/restore": "Upload photo for restoration (paid)",
                "/docs": "Interactive API documentation (free)",
                "/redoc": "Alternative API documentation (free)"
            },
            "how_to_use": {
                "1": "Prepare an old photograph (JPEG/PNG)",
                "2": "Send POST request to /restore with JSON: {\"image\": \"base64-encoded-data\"}",
                "3": "API will request payment (0.10 USDC on SKALE)",
                "4": "Complete payment using x402 client",
                "5": "Receive AI-generated restored and colorized image"
            }
        }

    @app.get("/health")
    async def health():
        """
        Health check endpoint - Free endpoint.

        Used by monitoring systems and container orchestration.
        """
        return {
            "status": "operational",
            "message": "Photo Restoration API is running",
            "services": {
                "opencv": "ready",
                "gemini": "ready",
                "payment_facilitator": "connected"
            }
        }

    @app.post("/restore")
    async def restore_photo(request: RestoreRequest):
        """
        Photo restoration endpoint - PAID (0.10 USDC on SKALE).

        This endpoint is protected by x402 payment middleware.
        Users must pay before accessing the restoration service.

        Accepts JSON payload with base64-encoded image data.

        Steps:
        1. First request: Returns 402 Payment Required with payment options
        2. Client creates payment and retries with Authorization header
        3. Middleware verifies payment via facilitator
        4. If valid: process photo and return results
        5. If invalid: return 403 Forbidden

        Args:
            request: JSON payload with base64-encoded image

        Returns:
            JSON with restored image (base64) and metadata

        Raises:
            HTTPException 400: Invalid image format or base64 encoding
            HTTPException 500: Processing error
        """
        # Note: Payment verification happens automatically via x402 middleware
        # If we reach this code, payment has been verified!

        logger.info(f"Processing image: {request.filename}")

        # Decode base64 image
        try:
            image_bytes = base64.b64decode(request.image)
            logger.info(f"Decoded {len(image_bytes)} bytes from base64")
        except Exception as e:
            logger.error(f"Failed to decode base64 image: {str(e)}")
            raise HTTPException(
                status_code=400,
                detail=f"Invalid base64 encoding: {str(e)}"
            )

        # Validate image is not empty
        if len(image_bytes) == 0:
            raise HTTPException(status_code=400, detail="Decoded image is empty")

        # Validate decoded image size (prevent memory exhaustion)
        MAX_IMAGE_BYTES = 50 * 1024 * 1024  # 50MB
        if len(image_bytes) > MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"Image too large. Maximum size: {MAX_IMAGE_BYTES // (1024*1024)}MB"
            )

        # Step 1: OpenCV preprocessing
        # Run in thread pool to prevent blocking the event loop (CPU-intensive operation)
        try:
            logger.info("Starting OpenCV preprocessing...")
            processed_bytes, opencv_metadata = await asyncio.to_thread(
                opencv_processor.process_image, image_bytes
            )
            logger.info(f"OpenCV processing complete: {opencv_metadata}")
        except ValueError as e:
            logger.error(f"Image processing error: {str(e)}")
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.error(f"Unexpected OpenCV error: {str(e)}")
            raise HTTPException(status_code=500, detail="Image processing failed")

        # Step 2: Gemini AI restoration analysis
        # Run in thread pool to prevent blocking the event loop (I/O-bound operation)
        try:
            logger.info("Starting Gemini restoration analysis...")
            restored_bytes, gemini_metadata = await asyncio.to_thread(
                gemini_restorer.restore_and_colorize, processed_bytes
            )
            logger.info(f"Gemini analysis complete")
        except Exception as e:
            logger.error(f"Gemini restoration error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"AI restoration failed: {str(e)}")

        # Encode result as base64 for JSON transport
        result_base64 = base64.b64encode(restored_bytes).decode('utf-8')

        # Return comprehensive result
        return {
            "success": True,
            "message": "Photo restoration completed successfully - AI-generated restored image",
            "original_filename": request.filename,
            "processing_pipeline": [
                "OpenCV preprocessing (perspective correction, enhancement, denoising)",
                "Gemini AI image generation (restoration and colorization)"
            ],
            "opencv_metadata": opencv_metadata,
            "gemini_metadata": {
                "service": gemini_metadata["service"],
                "sdk": gemini_metadata.get("sdk", "google-genai"),
                "restoration_type": gemini_metadata.get("restoration_type", "ai_generated"),
                "original_size": gemini_metadata.get("original_size"),
                "restored_size": gemini_metadata.get("restored_size"),
                "generation_notes": gemini_metadata.get("generation_notes", "")
            },
            "result": {
                "format": "JPEG",
                "encoding": "base64",
                "data": result_base64,
                "size_bytes": len(restored_bytes)
            },
            "usage_tip": "Decode the base64 'data' field to get the restored/colorized image file"
        }

    # 7. Apply x402 Payment Middleware (Official Pattern)
    # This middleware automatically handles:
    # - Returning 402 Payment Required responses
    # - Verifying payment signatures
    # - Calling the facilitator for verification
    # - Only allowing paid requests to reach handlers
    app.add_middleware(PaymentMiddlewareASGI, routes=routes, server=server)

    # Add ErrorLoggingMiddleware LAST so it's the OUTERMOST layer
    # This ensures it wraps x402 and handles payment verification errors gracefully
    app.add_middleware(ErrorLoggingMiddleware)

    logger.info("x402 PaymentMiddlewareASGI applied to protected routes")
    logger.info("Photo Restoration API created successfully!")

    return app
