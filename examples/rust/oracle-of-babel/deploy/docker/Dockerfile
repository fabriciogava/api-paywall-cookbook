# Build Stage
FROM rust:1.75-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache musl-dev

# Copy manifests
COPY Cargo.toml Cargo.lock* ./

# Create dummy src to cache dependencies
RUN mkdir -p src deploy/standalone && \
    echo "fn main() {}" > deploy/standalone/main.rs && \
    echo "pub fn dummy() {}" > src/lib.rs

# Build dependencies (this layer will be cached)
RUN cargo build --release --bin standalone || true

# Remove dummy files
RUN rm -rf src deploy

# Copy actual source code
COPY . .

# Build the application
RUN cargo build --release --bin standalone

# Runtime Stage
FROM alpine:3.19

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates

# Copy the binary from builder
COPY --from=builder /app/target/release/standalone ./oracle-of-babel

# Expose port
EXPOSE 3000

# Set environment
ENV PORT=3000
ENV HOST=0.0.0.0
ENV RUST_LOG=info

# Run the binary
CMD ["./oracle-of-babel"]
