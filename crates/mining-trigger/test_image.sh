#!/bin/bash

# This script tests the mining-trigger Docker image.
# It starts the container, runs a health check, and then cleans up.
#
# Usage: ./test_image.sh [IMAGE_NAME]
#   IMAGE_NAME (optional): The full name of the Docker image to test.
#                          Defaults to 'salamaashoush/mining-trigger:latest'.

set -e

# --- Configuration ---
IMAGE_NAME="${1:-salamaashoush/mining-trigger:latest}"
CONTAINER_NAME="mining-trigger-test"
HOST_PORT="1791"

# --- Run Test ---
echo "Starting container ${CONTAINER_NAME} from image ${IMAGE_NAME}..."
docker run -d --name "${CONTAINER_NAME}" -p "${HOST_PORT}:1791" "${IMAGE_NAME}"

# Give the container a moment to start
echo "Waiting for container to start..."
sleep 5

# --- Health Check ---
echo "Performing health check..."
STATUS_CODE=$(curl --silent --output /dev/null --write-out "%{http_code}" "http://localhost:${HOST_PORT}/health")

if [ "${STATUS_CODE}" -ne 200 ]; then
  echo "Health check failed! Expected status 200, but got ${STATUS_CODE}."
  echo "Dumping container logs:"
  docker logs "${CONTAINER_NAME}"
  # Cleanup will be handled by the trap
  exit 1
fi

echo "Health check passed!"

# --- Cleanup ---
# A trap to ensure cleanup happens even if the script fails
cleanup() {
  echo "Stopping and removing container ${CONTAINER_NAME}..."
  docker stop "${CONTAINER_NAME}" >/dev/null
  docker rm "${CONTAINER_NAME}" >/dev/null
}
trap cleanup EXIT
