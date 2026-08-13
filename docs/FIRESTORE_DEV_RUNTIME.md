# Firestore runtime (DEV + PROD)

**Primary runtime:** Firestore. Mongo Atlas is kept only as a cold standby until you confirm production is stable — then Atlas can be deleted.

| Env | Env file | Firestore DB | Backend port |
|-----|----------|--------------|--------------|
| DEV | `backend/.env.dev` | `lms-dev` | 5001 |
| PROD | `backend/.env` | `lms-prod` | 5000 |

Project: `skystateslms`. Do **not** use free-tier `(default)` (read caps / 429s).

Required env (never commit):

```
USE_FIRESTORE=true
FIRESTORE_PROJECT=skystateslms
FIRESTORE_DATABASE=lms-prod   # or lms-dev
FIRESTORE_OAUTH_CLIENT_ID=...
FIRESTORE_OAUTH_CLIENT_SECRET=...
FIRESTORE_OAUTH_REFRESH_TOKEN=...
```

Boot uses `connectDataStore()` → Firestore ping only; Mongo is **not** connected while `USE_FIRESTORE=true`.

## When to remove Mongo

After prod has soaked on Firestore with no data/auth issues:

1. Take a final Atlas snapshot/export if you want an offline archive
2. Delete or pause the Atlas cluster when you explicitly decide
3. Optional later cleanup: drop mongoose from runtime deps (export scripts can stay separate)

Until then, leave Atlas credentials in `.env` for emergency rollback only.

## Emergency rollback to Mongo

1. In `backend/.env` (or `.env.dev`) set `USE_FIRESTORE=false`
2. Recreate container:
   - PROD: `cd backend && docker compose -p shef-lms-prod -f docker-compose.yml up -d --force-recreate`
   - DEV: `docker compose -p shef-lms-dev -f docker-compose.dev.yml --env-file .env.dev up -d --force-recreate`
3. Verify health + login
4. Note: writes made only on Firestore after cutover are **not** on Atlas unless you reverse-sync

Optional image: `shef-lms-prod-backup:pre-firestore-cutover`

## Refresh Firestore from Mongo (one-way backup sync)

Only useful if you temporarily ran on Mongo and want to update the Firestore copy:

```bash
cd backend
node scripts/exportMongoToFirestore.js --db=lms --env=.env --database=lms-prod --prefix= --clear
node scripts/exportMongoToFirestore.js --db=shef-lms-dev --env=.env.dev --database=lms-dev --prefix= --clear
```
