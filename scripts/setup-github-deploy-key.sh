#!/bin/bash
# Run this ON YOUR VPS to generate an SSH key for GitHub Actions.
# Then add the private key to GitHub repo secrets.

set -e

KEY_PATH="$HOME/.ssh/github_deploy"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  GitHub Actions Deploy Key Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -f "$KEY_PATH" ]; then
    echo "Key already exists at $KEY_PATH"
    echo "Showing private key for VPS_SSH_KEY secret:"
    echo "─────────────────────────────────────"
    cat "$KEY_PATH"
    echo "─────────────────────────────────────"
    echo "Delete $KEY_PATH and re-run if you need a new key."
    exit 0
fi

mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

echo "Generating SSH key (no passphrase for CI)..."
ssh-keygen -t ed25519 -f "$KEY_PATH" -N "" -C "github-actions-deploy"

echo ""
echo "Adding public key to authorized_keys..."
cat "$KEY_PATH.pub" >> "$HOME/.ssh/authorized_keys"
chmod 600 "$HOME/.ssh/authorized_keys"

echo ""
echo "✅ Key created!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  NEXT: Add these to GitHub"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Go to: https://github.com/Abhi1727/Shef-LMS/settings/secrets/actions"
echo ""
echo "2. Add these repository secrets:"
echo ""
echo "   VPS_HOST  = Your VPS IP or hostname (e.g. 123.45.67.89)"
echo "   VPS_USER  = SSH user (e.g. root)"
echo "   VPS_SSH_KEY = (paste the entire private key below)"
echo ""
echo "   Private key contents:"
echo "   ─────────────────────────────────────"
cat "$KEY_PATH"
echo "   ─────────────────────────────────────"
echo ""
echo "3. Copy everything from -----BEGIN to -----END-----"
echo "   (including the BEGIN and END lines)"
echo ""
