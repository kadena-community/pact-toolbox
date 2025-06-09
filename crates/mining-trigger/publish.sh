#!/bin/bash

# This script builds and publishes the mining-trigger Docker image for multiple architectures.
# It requires Docker to be installed and the user to be logged into Docker Hub.
#
# Usage: ./publish.sh [TAG]
#   TAG (optional): The tag for the Docker image (e.g., v1.0.0). Defaults to 'latest'.

set -e

# --- Configuration ---
DOCKERHUB_USERNAME="salamaashoush"
IMAGE_NAME="mining-trigger"
TAG="${1:-latest}"
FULL_IMAGE_NAME="${DOCKERHUB_USERNAME}/${IMAGE_NAME}:${TAG}"
PLATFORMS="linux/amd64,linux/arm64"

# --- Build and Publish ---
echo "Building and publishing multi-arch Docker image for ${PLATFORMS}: ${FULL_IMAGE_NAME}"
# The context for the build is the parent directory (devnet)
# Note: You must be logged into Docker Hub for this step to succeed.
# Run 'docker login' in your terminal if you haven't already.
# You also may need to create a builder instance first:
# docker buildx create --name mybuilder --use
docker buildx build --platform "${PLATFORMS}" -t "${FULL_IMAGE_NAME}" -f Dockerfile .

docker push "${FULL_IMAGE_NAME}"

echo "Successfully published ${FULL_IMAGE_NAME}"
