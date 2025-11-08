#!/usr/bin/env bash
set -euo pipefail

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load .env from the project root (one level up from script/)
ENV_FILE="${SCRIPT_DIR}/../.env"

if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
else
  echo "❌ .env file not found in ${ENV_FILE}!"
  exit 1
fi

# --- Extract version from package.json ---
VERSION=$(node -p "require('${SCRIPT_DIR}/../package.json').version")

# --- Required variables ---
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_REGION:-"ap-southeast-1"} 
REPO_NAME=${ECR_REPO_NAME:-"my-service"}

# --- Derived variables ---
IMAGE_TAG="${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO_NAME}:v${VERSION}"
IMAGE_TAG_LATEST="${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO_NAME}:latest"

echo "📦 Building Docker image for ${REPO_NAME}:${VERSION}"
echo "🔁 Region: ${REGION}"
echo "🏷️ Tag: ${IMAGE_TAG}"

# --- Ensure repo exists ---
aws ecr describe-repositories --repository-names $REPO_NAME --region $REGION >/dev/null 2>&1 || \
  aws ecr create-repository --repository-name $REPO_NAME --region $REGION

# --- Login to ECR ---
aws ecr get-login-password --region $REGION | docker login \
  --username AWS \
  --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com

# --- Build and push multi-arch image in one command ---
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t "${IMAGE_TAG}" \
  -t "${IMAGE_TAG_LATEST}" \
  --push \
  "${SCRIPT_DIR}/.."

# --- Create a multi-arch manifest list ---
echo "✅ Multi-arch image pushed successfully!"
echo "🖇️ Tags:"
echo "   - Versioned: ${IMAGE_TAG}"
echo "   - Latest: ${IMAGE_TAG_LATEST}"

# chmod +x deploy-ecr.sh to use