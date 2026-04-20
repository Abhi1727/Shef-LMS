#!/bin/bash
# Migrate MongoDB data from PRODUCTION to DEV
# Uses backend/scripts/cloneProdToDev.js (Node/Mongoose - no external tools)
# Run from project root

set -e
cd "$(dirname "$0")/.."

echo "📦 Migrate Prod → Dev MongoDB"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ! -f backend/.env ]; then
    echo "❌ backend/.env not found (prod config)"
    exit 1
fi
if [ ! -f backend/.env.dev ]; then
    echo "❌ backend/.env.dev not found"
    exit 1
fi

cd backend
node scripts/cloneProdToDev.js
cd ..
echo ""
