"""
Unit tests for configuration validation.

Tests the AppConfig model and environment variable loading.
"""

import pytest
from pydantic import ValidationError


def test_valid_config():
    """
    Test that a valid configuration is accepted.
    """
    from app import AppConfig

    config = AppConfig(
        wallet_address="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        facilitator_url="https://gateway.kobaru.io",
        gemini_api_key="test_gemini_key"
    )

    assert config.wallet_address == "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
    assert config.facilitator_url == "https://gateway.kobaru.io"
    assert config.gemini_api_key == "test_gemini_key"
    assert config.kobaru_api_key is None  # Optional


def test_config_with_optional_kobaru_key():
    """
    Test that Kobaru API key is optional.
    """
    from app import AppConfig

    config = AppConfig(
        wallet_address="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        facilitator_url="https://gateway.kobaru.io",
        gemini_api_key="test_gemini_key",
        kobaru_api_key="test_kobaru_key"
    )

    assert config.kobaru_api_key == "test_kobaru_key"


def test_config_requires_wallet_address():
    """
    Test that wallet address is required.
    """
    from app import AppConfig

    with pytest.raises(ValidationError):
        AppConfig(
            facilitator_url="https://gateway.kobaru.io",
            gemini_api_key="test_key"
            # Missing wallet_address
        )


def test_config_requires_gemini_api_key():
    """
    Test that Gemini API key is required.
    """
    from app import AppConfig

    with pytest.raises(ValidationError):
        AppConfig(
            wallet_address="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
            facilitator_url="https://gateway.kobaru.io"
            # Missing gemini_api_key
        )


def test_config_default_facilitator_url():
    """
    Test that facilitator URL has a default value.
    """
    from app import AppConfig

    config = AppConfig(
        wallet_address="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        gemini_api_key="test_key"
        # Not specifying facilitator_url, should use default
    )

    assert config.facilitator_url == "https://gateway.kobaru.io"


def test_config_custom_facilitator_url():
    """
    Test that custom facilitator URL can be set.
    """
    from app import AppConfig

    custom_url = "https://custom-facilitator.example.com"
    config = AppConfig(
        wallet_address="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        facilitator_url=custom_url,
        gemini_api_key="test_key"
    )

    assert config.facilitator_url == custom_url


def test_wallet_address_format():
    """
    Test that wallet address is stored as a string (format validation would be in deployment adapter).
    """
    from app import AppConfig

    wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
    config = AppConfig(
        wallet_address=wallet,
        facilitator_url="https://gateway.kobaru.io",
        gemini_api_key="test_key"
    )

    assert isinstance(config.wallet_address, str)
    assert config.wallet_address == wallet
