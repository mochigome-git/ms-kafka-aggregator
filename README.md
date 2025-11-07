# ms-kafka-aggregator

current version: `v1.0.0`

### Enable cross-arch builds with Docker Buildx (local)

```bash
docker buildx create --name mybuilder --use
docker run --privileged --rm tonistiigi/binfmt --install all   # registers qemu for local emulation (if needed)
docker buildx inspect --bootstrap

# Build for arm64 only & push to registry:
docker buildx build --platform linux/arm64 -t <registry>/my-service:latest --push .

# OR multi-arch (arm64 + amd64):
docker buildx build --platform linux/arm64,linux/amd64 -t <registry>/my-service:latest --push .
```

### Push image to AWS ECR

```bash
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=us-east-1                        # change to your region
REPO_NAME=my-service

# create repo if not exists
aws ecr create-repository --repository-name $REPO_NAME --region $REGION || true

# login
aws ecr get-login-password --region $REGION \
  | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# tag and push (use buildx push to support multi-arch)
docker buildx build --platform linux/arm64,linux/amd64 \
  -t $AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME:latest \
  --push .

```
