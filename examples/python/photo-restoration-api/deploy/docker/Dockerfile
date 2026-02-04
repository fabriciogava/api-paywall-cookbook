# Multi-stage Docker build for Photo Restoration API
# Stage 1: Builder - Install dependencies
# Stage 2: Runtime - Minimal production image

# ============================================================================
# Stage 1: Builder
# ============================================================================
FROM python:3.12-slim as builder

# Install build dependencies needed for Python packages
# - gcc: C compiler for building extensions
# - g++: C++ compiler
# - make: Build automation
# - libopencv-dev: OpenCV development headers
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    make \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /build

# Copy requirements first (better layer caching)
COPY requirements.txt .

# Install Python dependencies into /install
# Using --prefix to install to a custom location that we'll copy to runtime
RUN pip install --prefix=/install --no-cache-dir -r requirements.txt


# ============================================================================
# Stage 2: Runtime
# ============================================================================
FROM python:3.12-slim

# Install runtime dependencies for OpenCV
# These are the minimal libraries needed to run OpenCV without the dev headers
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

# Copy application code
# We copy src/ and deploy/ separately to match our directory structure
COPY src/ ./src/
COPY deploy/standalone/ ./deploy/standalone/

# Expose port 3000 (default for our API)
EXPOSE 3000

# Environment variables with sensible defaults
# These can be overridden when running the container
ENV PORT=3000
ENV FACILITATOR_URL=https://gateway.kobaru.io
ENV PYTHONUNBUFFERED=1

# Health check - verify the API is responding
# This allows Docker/Kubernetes to know if the container is healthy
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:3000/health')"

# Run the application
# Note: We use exec form of CMD to properly handle signals (Ctrl+C, etc.)
CMD ["python", "deploy/standalone/main.py"]

# Build instructions:
# docker build -t photo-restoration-api -f deploy/docker/Dockerfile .
#
# Run instructions:
# docker run -p 3000:3000 \
#   -e SKALE_WALLET_ADDRESS=0x... \
#   -e GEMINI_API_KEY=... \
#   photo-restoration-api
