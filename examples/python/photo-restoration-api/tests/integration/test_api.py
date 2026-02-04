"""
Integration tests for the FastAPI application.

Tests the complete API functionality for free endpoints.

Note: Payment flow is tested manually with 007-test-agent.
The PaymentMiddlewareASGI is tested by the x402 SDK maintainers.
Our tests focus on our business logic (OpenCV, Gemini).
"""

import pytest
from fastapi.testclient import TestClient


@pytest.mark.asyncio
async def test_root_endpoint(test_app):
    """
    Test that the root endpoint returns API information.
    """
    client = TestClient(test_app)
    response = client.get("/")

    assert response.status_code == 200
    data = response.json()

    assert "name" in data
    assert data["name"] == "Photo Restoration API"
    assert "endpoints" in data
    assert "pricing" in data
    assert data["pricing"]["restoration"] == "$0.10"


@pytest.mark.asyncio
async def test_health_endpoint(test_app):
    """
    Test that the health endpoint returns operational status.
    """
    client = TestClient(test_app)
    response = client.get("/health")

    assert response.status_code == 200
    data = response.json()

    assert "status" in data
    assert data["status"] == "operational"
    assert "services" in data


@pytest.mark.asyncio
async def test_docs_endpoint_accessible(test_app):
    """
    Test that OpenAPI docs are accessible.
    """
    client = TestClient(test_app)
    response = client.get("/docs")

    # Swagger UI returns HTML
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


@pytest.mark.asyncio
async def test_cors_headers_present(test_app):
    """
    Test that CORS headers are properly configured.
    This API should be accessible from any origin since access control
    is handled via payments, not CORS.
    """
    client = TestClient(test_app)
    response = client.options(
        "/",
        headers={
            "Origin": "http://example.com",
            "Access-Control-Request-Method": "GET",
        }
    )

    # CORS should allow all origins
    assert "access-control-allow-origin" in response.headers
