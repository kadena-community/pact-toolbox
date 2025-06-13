# Multi-stage build for minimal image size
# Build stage with Rust toolchain
FROM rust:alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    musl-dev \
    openssl-dev \
    openssl-libs-static \
    pkgconfig \
    ca-certificates

# Create app directory
WORKDIR /app

# Copy manifests first for better caching
COPY Cargo.toml Cargo.lock ./

# Add musl target for the current platform
ARG TARGETPLATFORM
RUN case ${TARGETPLATFORM} in \
        "linux/amd64") rustup target add x86_64-unknown-linux-musl ;; \
        "linux/arm64") rustup target add aarch64-unknown-linux-musl ;; \
        *) echo "Unsupported platform: ${TARGETPLATFORM}"; exit 1 ;; \
    esac

# Set the build target based on platform
RUN case ${TARGETPLATFORM} in \
        "linux/amd64") echo "x86_64-unknown-linux-musl" > /target.txt ;; \
        "linux/arm64") echo "aarch64-unknown-linux-musl" > /target.txt ;; \
        *) echo "Unsupported platform: ${TARGETPLATFORM}"; exit 1 ;; \
    esac

# Create dummy source files to cache dependencies
RUN mkdir -p src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release --target $(cat /target.txt) && \
    rm -rf src

# Copy actual source code
COPY src ./src

# Build with maximum optimizations (already configured in Cargo.toml)
RUN cargo build --release --target $(cat /target.txt) && \
    cp target/$(cat /target.txt)/release/chainweb-mining-trigger /chainweb-mining-trigger

# Runtime stage - using alpine for proper runtime support
FROM alpine:latest

# Install CA certificates for HTTPS connections
RUN apk add --no-cache ca-certificates

# Copy the binary
COPY --from=builder /chainweb-mining-trigger /chainweb-mining-trigger

# Make sure it's executable
RUN chmod +x /chainweb-mining-trigger

# Set entrypoint
ENTRYPOINT ["/chainweb-mining-trigger"]
