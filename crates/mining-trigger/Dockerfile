# ---- Builder ----
FROM rust:1.87-slim-bookworm AS builder

WORKDIR /usr/src/mining-trigger

# Install dependencies
RUN apt-get update && apt-get install -y build-essential pkg-config libssl-dev

# Copy source and build
COPY . .
RUN cargo build --release

# ---- Final Image ----
FROM debian:bookworm-slim

# Install required shared libraries
RUN apt-get update && apt-get install -y libssl3 && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/local/bin

# Copy binary from builder
COPY --from=builder /usr/src/mining-trigger/target/release/mining-trigger .

# Run as non-root user
RUN useradd --create-home appuser
USER appuser

# Set entrypoint
ENTRYPOINT ["/usr/local/bin/mining-trigger"]
