#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sheflms.com","password":"SuperAdmin@123"}' | \
  python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")

curl -X POST http://localhost:5000/api/zoom/sync-recordings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
