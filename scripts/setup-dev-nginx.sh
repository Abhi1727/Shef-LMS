#!/bin/bash
# One-time setup: Add dev.learnwithus.sbs to Nginx
# Run as root: sudo ./scripts/setup-dev-nginx.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NGINX_DEV="$PROJECT_ROOT/scripts/nginx-dev.conf"

echo "Adding dev.learnwithus.sbs server block to Nginx..."

if grep -q "dev.learnwithus.sbs" /etc/nginx/sites-enabled/* 2>/dev/null; then
    echo "Dev server block already configured."
else
    cp "$NGINX_DEV" /etc/nginx/sites-available/shef-lms-dev
    ln -sf /etc/nginx/sites-available/shef-lms-dev /etc/nginx/sites-enabled/
    echo "Added dev server block."
fi

nginx -t && systemctl reload nginx
echo "Add DNS A record: dev.learnwithus.sbs -> your VPS IP"
