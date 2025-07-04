#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Check if a version tag is provided
if [ -z "$1" ]; then
  echo "Error: No version tag provided."
  echo "Usage: ./release.sh vX.Y.Z"
  echo "Example: ./release.sh v0.1.0"
  exit 1
fi

VERSION=$1

# Check if the tag matches the format vX.Y.Z
if ! [[ $VERSION =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: Version tag must be in the format vX.Y.Z"
    echo "Example: v0.1.0"
    exit 1
fi

echo "Creating git tag: ${VERSION}"
git tag "${VERSION}"

echo "Pushing git tag: ${VERSION}"
git push origin "${VERSION}"

echo "Successfully pushed tag. The release workflow has been triggered."
echo "Check the 'Actions' tab in your GitHub repository for progress."
