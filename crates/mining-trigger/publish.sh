#!/bin/bash
set -euo pipefail

# --- Configuration ---
# !!! IMPORTANT !!!
# Change this to your Docker Hub username or a different container registry.
REGISTRY="salamaashoush"
IMAGE_NAME="mining-trigger"

# --- DO NOT EDIT BELOW THIS LINE ---
# Get version from Cargo.toml
VERSION=$(grep '^version =' Cargo.toml | sed 's/version = "\(.*\)"/\1/')
if [ -z "$VERSION" ]; then
  echo "Error: Could not determine version from Cargo.toml"
  exit 1
fi

FULL_IMAGE_NAME_VERSIONED="${REGISTRY}/${IMAGE_NAME}:${VERSION}"
FULL_IMAGE_NAME_LATEST="${REGISTRY}/${IMAGE_NAME}:latest"

echo "Building and pushing version: ${VERSION}"
echo "Target tags:"
echo "  - ${FULL_IMAGE_NAME_VERSIONED}"
echo "  - ${FULL_IMAGE_NAME_LATEST}"
echo

# --- Buildx Setup ---
BUILDER_NAME="multi-arch-builder"
if ! docker buildx ls | grep -q "${BUILDER_NAME}"; then
  echo "Creating new buildx builder: ${BUILDER_NAME}"
  docker buildx create --name "${BUILDER_NAME}" --use
else
  echo "Using existing buildx builder: ${BUILDER_NAME}"
  docker buildx use "${BUILDER_NAME}"
fi
docker buildx inspect --bootstrap

# --- Build and Push ---
echo "Starting multi-platform build for linux/amd64 and linux/arm64..."
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag "${FULL_IMAGE_NAME_VERSIONED}" \
  --tag "${FULL_IMAGE_NAME_LATEST}" \
  --file Dockerfile \
  --push \
  .

echo
echo "✅ Successfully built and pushed multi-arch image."
echo "   - ${FULL_IMAGE_NAME_VERSIONED}"
echo "   - ${FULL_IMAGE_NAME_LATEST}"
