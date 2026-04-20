#!/bin/bash
# Sync DEV server with PRODUCTION: same code (main branch) + same data (prod → dev MongoDB)
# Run from project root

set -e
cd "$(dirname "$0")/.."

echo "🔄 Sync DEV with PRODUCTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Ensure latest main
echo "1️⃣  Fetch latest main..."
git fetch origin main 2>/dev/null || true
CURRENT=$(git rev-parse HEAD)
MAIN=$(git rev-parse origin/main)
if [ "$CURRENT" != "$MAIN" ]; then
    echo "   Checking out main (was: $CURRENT)"
    git checkout main
    git pull origin main
else
    echo "   ✓ Already on latest main"
fi
echo ""

# Migrate prod data to dev
echo "2️⃣  Migrating prod MongoDB → dev MongoDB..."
./scripts/migrate-prod-to-dev.sh
echo ""

# Deploy dev (frontend + backend)
echo "3️⃣  Deploying to dev (dev.learnwithus.sbs)..."
./scripts/deploy-dev.sh
echo ""

echo "✅ Sync complete! Dev matches prod."
echo "   Dev: https://dev.learnwithus.sbs"
echo ""
