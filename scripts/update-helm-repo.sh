#!/bin/bash
#
# Script to manually update the Helm chart repository on GitHub Pages
# This is automated via GitHub Actions, but you can run this manually if needed
#

set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
CHART_DIR="$REPO_ROOT/deploy/helm/fluxiondb"
CHART_REPO_DIR="$REPO_ROOT/charts"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 Packaging Helm Chart...${NC}"

# Create charts directory if it doesn't exist
mkdir -p "$CHART_REPO_DIR"

# Package the chart
cd "$REPO_ROOT"
helm package "$CHART_DIR" -d "$CHART_REPO_DIR"

echo -e "${BLUE}📋 Updating Helm repository index...${NC}"

# Get the GitHub repo URL
GITHUB_USER=$(git config --get remote.origin.url | sed -n 's/.*github.com[:/]\([^/]*\).*/\1/p')
GITHUB_REPO=$(git config --get remote.origin.url | sed -n 's/.*github.com[:/][^/]*\/\([^.]*\).*/\1/p')
CHART_URL="https://${GITHUB_USER}.github.io/${GITHUB_REPO}/charts"

# Update the index
helm repo index "$CHART_REPO_DIR" --url "$CHART_URL"

echo -e "${GREEN}✅ Helm chart packaged successfully!${NC}"
echo ""
echo -e "${BLUE}Files created in charts/:${NC}"
ls -lh "$CHART_REPO_DIR"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. git add charts/"
echo "  2. git commit -m 'update helm chart'"
echo "  3. git push"
echo ""
echo -e "${BLUE}Users can then install with:${NC}"
echo "  helm repo add fluxiondb $CHART_URL"
echo "  helm repo update"
echo "  helm install my-fluxiondb fluxiondb/fluxiondb"

