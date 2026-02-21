#!/bin/bash
# Update live Nginx config: no-cache for index.html (fixes stale app after deploy)
# Run: sudo bash scripts/update-nginx-cache-headers.sh

set -e
NGINX_CONF="/etc/nginx/sites-available/shef-lms"

if [ ! -f "$NGINX_CONF" ]; then
  echo "Nginx config not found at $NGINX_CONF"
  exit 1
fi

if grep -q "location = /index.html" "$NGINX_CONF"; then
  echo "Nginx config already has index.html no-cache."
else
  # Create temp file with the new config
  awk '
    /# Frontend - SPA routing/ {
      print "    # index.html - never cache so users get latest app after deploy"
      print "    location = /index.html {"
      print "        add_header Cache-Control \"no-store, no-cache, must-revalidate\" always;"
      print "        add_header Pragma \"no-cache\" always;"
      print "        try_files $uri =404;"
      print "    }"
      print ""
    }
    /location \/ \{/ && !done {
      print "        add_header Cache-Control \"no-store, no-cache\" always;"
      done=1
    }
    { print }
  ' "$NGINX_CONF" > "${NGINX_CONF}.tmp" && mv "${NGINX_CONF}.tmp" "$NGINX_CONF"
  echo "Added index.html no-cache rules."
fi

# Add CF-Connecting-IP for Cloudflare if not present
if ! grep -q "CF-Connecting-IP" "$NGINX_CONF"; then
  sed -i '/proxy_set_header X-Forwarded-Proto/a\        proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;' "$NGINX_CONF"
  echo "Added CF-Connecting-IP passthrough for Cloudflare."
fi

nginx -t && systemctl reload nginx && echo "Nginx reloaded successfully."
