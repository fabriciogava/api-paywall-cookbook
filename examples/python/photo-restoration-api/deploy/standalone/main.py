#!/usr/bin/env python3
"""
Standalone Deployment Adapter

This is the platform adapter that runs the Photo Restoration API
as a standalone Python server using uvicorn.

Responsibilities:
1. Load environment variables
2. Validate configuration (fail fast on missing required vars)
3. Build AppConfig object
4. Call the factory function to create the app
5. Start the uvicorn server

This separation allows the core app (src/app.py) to remain platform-agnostic
and testable without environment dependencies.
"""

import os
import sys
import asyncio
import logging
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Enable DEBUG logging for x402 to see what's happening in the payment middleware
logging.getLogger("x402").setLevel(logging.DEBUG)
logging.getLogger("httpx").setLevel(logging.DEBUG)

# Add src directory to Python path so we can import our app
src_path = Path(__file__).parent.parent.parent / "src"
sys.path.insert(0, str(src_path))

from app import create_app, AppConfig
import uvicorn


def load_config() -> AppConfig:
    """
    Loads configuration from environment variables.

    Required variables:
    - SKALE_WALLET_ADDRESS: Your Ethereum wallet address (receives payments)
    - GEMINI_API_KEY: Google AI API key for Gemini access

    Optional variables:
    - FACILITATOR_URL: Kobaru gateway URL (default: https://gateway.kobaru.io)
    - KOBARU_API_KEY: API key for Kobaru premium features
    - RESTORATION_PRICE: Price per restoration (default: $0.10)
    - NETWORK_ID: Blockchain network in CAIP-2 format (default: eip155:1187947933)
    - ASSET_ADDRESS: Token contract address (default: SKALE USDC)
    - PORT: HTTP server port (default: 3000)

    Returns:
        AppConfig object

    Raises:
        SystemExit: If required variables are missing
    """
    # Required configuration
    wallet_address = os.getenv("SKALE_WALLET_ADDRESS")
    gemini_api_key = os.getenv("GEMINI_API_KEY")

    # Optional configuration with defaults
    facilitator_url = os.getenv("FACILITATOR_URL", "https://gateway.kobaru.io")
    kobaru_api_key = os.getenv("KOBARU_API_KEY")
    restoration_price = os.getenv("RESTORATION_PRICE", "$0.10")
    network_id = os.getenv("NETWORK_ID", "eip155:1187947933")
    asset_address = os.getenv("ASSET_ADDRESS", "0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20")

    # Validation: Fail fast if required config is missing
    errors = []

    if not wallet_address:
        errors.append("❌ SKALE_WALLET_ADDRESS environment variable is required")

    if not gemini_api_key:
        errors.append("❌ GEMINI_API_KEY environment variable is required")

    if errors:
        print("\n🚨 Configuration Error - Missing Required Environment Variables:\n")
        for error in errors:
            print(f"  {error}")
        print("\n📝 Please set these variables in your .env file or environment.")
        print("   See .env.example for reference.\n")
        sys.exit(1)

    # Validate wallet address format (basic check)
    if not wallet_address.startswith("0x") or len(wallet_address) != 42:
        print("⚠️  WARNING: Wallet address doesn't look like a valid Ethereum address")
        print(f"   Expected format: 0x followed by 40 hex characters")
        print(f"   Got: {wallet_address}")
        print()

    # Validate network ID format
    if ":" not in network_id:
        print("⚠️  WARNING: NETWORK_ID should be in CAIP-2 format (e.g., eip155:1187947933)")
        print(f"   Got: {network_id}")
        print()

    return AppConfig(
        wallet_address=wallet_address,
        facilitator_url=facilitator_url,
        gemini_api_key=gemini_api_key,
        kobaru_api_key=kobaru_api_key,
        restoration_price=restoration_price,
        network_id=network_id,
        asset_address=asset_address,
    )


async def main():
    """
    Main entry point for the standalone server.

    Steps:
    1. Print startup banner
    2. Load and validate configuration
    3. Create the FastAPI app
    4. Start uvicorn server
    """
    print("""
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║          📸 Photo Restoration API 📸                      ║
║                                                           ║
║     Bringing old memories back to life with AI           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
""")

    # Load configuration
    print("🔧 Loading configuration from environment...")
    try:
        config = load_config()
        print("✅ Configuration loaded successfully")
        print(f"   • Facilitator: {config.facilitator_url}")
        print(f"   • Wallet: {config.wallet_address}")
        print(f"   • Gemini API: {'Configured' if config.gemini_api_key else 'Not configured'}")
        print(f"   • Kobaru API Key: {'Configured (Premium)' if config.kobaru_api_key else 'Not configured (Standard)'}")
        print()
    except Exception as e:
        print(f"❌ Configuration error: {str(e)}")
        sys.exit(1)

    # Create the FastAPI application
    print("🚀 Creating Photo Restoration API...")
    try:
        app = await create_app(config)
        print("✅ Application created successfully")
        print()
    except Exception as e:
        print(f"❌ Failed to create application: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    # Get port from environment or use default
    port = int(os.getenv("PORT", "3000"))

    # Server configuration
    print("🌐 Starting HTTP server...")
    print(f"   • Port: {port}")
    print(f"   • URL: http://localhost:{port}")
    print(f"   • Docs: http://localhost:{port}/docs")
    print(f"   • Health: http://localhost:{port}/health")
    print()
    print("💳 Payment Information:")
    print(f"   • Network: {config.network_id}")
    print(f"   • Token: {config.asset_address}")
    print(f"   • Price: {config.restoration_price} per restoration")
    print()
    print("🧪 Testing:")
    print("   To test payments, use the 007-test-agent:")
    print("   cd ../../tools/007-test-agent")
    print(f"   npm start http://localhost:{port}/restore")
    print()
    print("Press Ctrl+C to stop the server")
    print("─" * 63)
    print()

    # Start the server using async API (we're already in an async context)
    # Note: We use Server.serve() instead of uvicorn.run() because we're
    # already inside an event loop created by asyncio.run()
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info",
        access_log=True
    )
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    # Run the async main function with graceful shutdown on Ctrl+C
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Shutting down gracefully...")
        print("✅ Server stopped successfully")
