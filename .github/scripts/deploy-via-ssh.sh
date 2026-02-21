#!/bin/bash
set -e
# Deploy via SSH - avoids multiline env issues in GitHub Actions
# Args: key_file host user
KEY_FILE="$1"
HOST="$2"
USER="$3"
if [ -z "$KEY_FILE" ] || [ -z "$HOST" ] || [ -z "$USER" ]; then
  echo "::error::Missing args. Usage: $0 <key_file> <host> <user>"
  exit 1
fi
if echo "$HOST" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
  :  # HOST looks like IP
else
  echo "::error::HOST should be IP address, length=${#HOST} firstchars=${HOST:0:20}"
  exit 1
fi
ssh -o StrictHostKeyChecking=no -o BatchMode=yes -i "$KEY_FILE" "${USER}@${HOST}" '
  set -e
  cd /root/Shef-LMS
  git fetch origin develop
  git checkout develop
  git pull origin develop
  ./scripts/deploy-dev.sh
'
