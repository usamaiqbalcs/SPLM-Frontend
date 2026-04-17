#!/usr/bin/env bash
# deploy-production.sh — Build frontend and sync to S3 + invalidate CloudFront
#
# Usage:
#   VITE_API_BASE_URL=https://<id>.execute-api.us-east-1.amazonaws.com \
#   S3_BUCKET=your-s3-bucket-name \
#   CF_DISTRIBUTION_ID=your-cloudfront-distribution-id \
#   ./scripts/deploy-production.sh
#
# All three env vars are required. The script will fail fast if any are missing.

set -euo pipefail

# ── Validate required env vars ────────────────────────────────────────────────
: "${VITE_API_BASE_URL:?ERROR: VITE_API_BASE_URL must be set to your API Gateway invoke URL}"
: "${S3_BUCKET:?ERROR: S3_BUCKET must be set to your S3 bucket name}"
: "${CF_DISTRIBUTION_ID:?ERROR: CF_DISTRIBUTION_ID must be set to your CloudFront distribution ID}"

echo "Building with VITE_API_BASE_URL=${VITE_API_BASE_URL}"

# ── Install deps ──────────────────────────────────────────────────────────────
npm ci

# ── Build — Vite bakes VITE_API_BASE_URL into the bundle here ─────────────────
VITE_API_BASE_URL="${VITE_API_BASE_URL}" npm run build

# ── Sync to S3 ────────────────────────────────────────────────────────────────
echo "Syncing dist/ to s3://${S3_BUCKET}..."
aws s3 sync dist/ "s3://${S3_BUCKET}" \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html"

# index.html must never be cached — SPA routing depends on always getting the latest
aws s3 cp dist/index.html "s3://${S3_BUCKET}/index.html" \
  --cache-control "no-cache,no-store,must-revalidate" \
  --content-type "text/html"

# ── Invalidate CloudFront ─────────────────────────────────────────────────────
echo "Invalidating CloudFront distribution ${CF_DISTRIBUTION_ID}..."
aws cloudfront create-invalidation \
  --distribution-id "${CF_DISTRIBUTION_ID}" \
  --paths "/*"

echo "Deploy complete."
