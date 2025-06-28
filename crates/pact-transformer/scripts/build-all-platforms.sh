#!/bin/bash
# Build script for all platforms (for local testing)
# Note: In production, the CI workflow handles cross-platform builds

set -e

echo "Building pact-transformer for all platforms..."

# Build for current platform
echo "Building for current platform..."
pnpm build

# List of all supported targets
targets=(
  "x86_64-pc-windows-msvc"
  "i686-pc-windows-msvc"
  "aarch64-pc-windows-msvc"
  "x86_64-apple-darwin"
  "aarch64-apple-darwin"
  "x86_64-unknown-linux-gnu"
  "x86_64-unknown-linux-musl"
  "aarch64-unknown-linux-gnu"
  "aarch64-unknown-linux-musl"
  "armv7-unknown-linux-gnueabihf"
  "aarch64-linux-android"
  "x86_64-unknown-freebsd"
  "aarch64-unknown-linux-musl"
  "armv7-linux-androideabi"
  "wasm32-wasip1-threads"
)

# Check if cross is installed
if ! command -v cross &>/dev/null; then
  echo "Warning: 'cross' is not installed. Only native builds will work."
  echo "Install cross with: cargo install cross"
fi

# Try to build for each target
for target in "${targets[@]}"; do
  echo "Attempting to build for $target..."
  if pnpm build --target "$target" 2>/dev/null; then
    echo "✓ Successfully built for $target"
  else
    echo "✗ Failed to build for $target (this is expected for cross-compilation without proper toolchain)"
  fi
done

echo "Build process completed!"
