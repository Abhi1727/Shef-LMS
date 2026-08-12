# Firestore DEV runtime — rollback
#
# DEV uses Firestore when USE_FIRESTORE=true in backend/.env.dev.
# Production is untouched and stays on Mongo.
#
# Rollback DEV to Mongo (under 2 minutes):
#   1. In backend/.env.dev set: USE_FIRESTORE=false
#   2. Restart: cd backend && docker compose -p shef-lms-dev -f docker-compose.dev.yml up -d --force-recreate
#   3. Verify: curl -s http://127.0.0.1:5001/api/health
#
# Re-enable Firestore:
#   USE_FIRESTORE=true + recreate container (OAuth refresh token must remain set).
