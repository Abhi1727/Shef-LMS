#!/bin/bash
# Release code from develop to production (learnwithus.sbs).
#
# What this does:
#   - Fetches latest develop + main
#   - Merges origin/develop into main
#   - Runs ./scripts/deploy-production.sh (build + Docker on this host)
#
# What this does NOT do:
#   - It does NOT copy the dev MongoDB into production. Doing that would
#     replace every live user, batch, and lecture record with whatever
#     exists on dev and is almost always wrong when real students use prod daily.
#     If you truly need dev data on prod (rare), run manually:
#       cd backend && npm run clone:dev-to-prod -- --confirm
#     only after backups and with full understanding of data loss.
#
# Prerequisites: clean git working tree, run from repo root or via path below.
# CI/CD: If you push main from here, GitHub Actions may also deploy; that is OK.

set -e
cd "$(dirname "$0")/.."

echo "🚀 Release develop → production (code only, no DB overwrite)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "❌ Working tree is not clean. Commit or stash changes, then retry."
  echo "   (Or export ALLOW_DIRTY=1 to bypass — not recommended.)"
  if [ "${ALLOW_DIRTY:-}" != "1" ]; then
    exit 1
  fi
  echo "   ⚠️  ALLOW_DIRTY=1 set; continuing anyway."
fi

echo "📥 Fetching origin (develop, main)..."
git fetch origin develop main 2>/dev/null || git fetch origin

echo ""
echo "🔀 Checking out main and merging develop..."
git checkout main
git pull origin main
git merge origin/develop --no-edit -m "Release: merge develop into main for production"

echo ""
echo "📦 Deploying production on this server..."
./scripts/deploy-production.sh

echo ""
echo "✅ Local main includes develop and production deploy ran on this host."
echo ""
echo "If you use remote CI/CD, push main when ready:"
echo "   git push origin main"
echo ""
