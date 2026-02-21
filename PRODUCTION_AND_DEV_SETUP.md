# Production + Dev/Staging Setup

Keep production safe: develop and test on **dev.learnwithus.sbs** before deploying to **learnwithus.sbs**.

---

## Architecture

| Environment | URL | Backend Port | MongoDB DB | Purpose |
|-------------|-----|--------------|------------|---------|
| **Production** | learnwithus.sbs | 5000 | shef-lms | Live clients |
| **Dev/Staging** | dev.learnwithus.sbs | 5001 | shef-lms-dev | Testing, experiments |

- Same VPS, same MongoDB cluster, **different database** for dev
- Production data is never touched by dev

---

## One-Time Setup

### 1. Create Dev Backend Config

```bash
cd backend
cp .env.dev.example .env.dev
# Edit .env.dev - set:
#   - MONGODB_URI or MONGODB_* with database shef-lms-dev
#   - MONGO_DB_NAME=shef-lms-dev
#   - ALLOWED_ORIGINS including https://dev.learnwithus.sbs
```

### 2. Add Dev DNS Record

In Hostinger (or your DNS provider), add:

- **Type:** A  
- **Name:** dev  
- **Points to:** Your VPS IP (same as main domain)

### 3. Add Dev to Nginx

```bash
sudo ./scripts/setup-dev-nginx.sh
# Or manually append scripts/nginx-dev.conf to your nginx config
```

### 4. Get SSL for Dev (after DNS propagates)

```bash
sudo certbot --nginx -d dev.learnwithus.sbs --non-interactive
```

---

## Git Workflow (CI/CD – no VPS access needed)

```
develop  ──►  push  ──►  auto-deploy to dev.learnwithus.sbs
                │
                └──►  merge to main  ──►  push  ──►  auto-deploy to learnwithus.sbs
```

- **develop** – work here; push → auto-deploys to dev
- **main** – merge from develop; push → auto-deploys to production

### Branch commands

```bash
# Daily: work on develop (you + juniors, from laptops)
git checkout develop
# ... make changes ...
git add -A && git commit -m "Feature: ..." && git push origin develop
# → CI/CD auto-deploys to dev.learnwithus.sbs

# When ready: merge to main (admin only)
git checkout main
git merge develop
git push origin main
# → CI/CD auto-deploys to learnwithus.sbs (production)
```

No SSH, no manual deploy scripts. See [CI_CD_SETUP.md](CI_CD_SETUP.md) for GitHub Secrets setup.

---

## Deploy Commands

### Deploy to Dev (safe, for testing)

```bash
./scripts/deploy-dev.sh
```

- Deploys **current branch** to dev.learnwithus.sbs  
- Uses backend on port 5001, DB `shef-lms-dev`  
- No impact on production

### Deploy to Production (live clients)

```bash
./scripts/deploy-production.sh
```

- Intended for **main** branch  
- Deploys to learnwithus.sbs  
- Uses production DB

---

## Quick Reference

| Task | Command |
|------|---------|
| Deploy to dev | `./scripts/deploy-dev.sh` |
| Deploy to production | `./scripts/deploy-production.sh` |
| Dev backend logs | `docker logs -f shef-lms-backend-dev` |
| Prod backend logs | `docker logs -f shef-lms-backend` |
| Restart dev backend | `cd backend && docker compose -f docker-compose.dev.yml restart` |
| **Auto-deploy dev** | Push to `develop` → dev.learnwithus.sbs |
| **Auto-deploy prod** | Push to `main` → learnwithus.sbs |
| **Setup** | [CI_CD_SETUP.md](CI_CD_SETUP.md) |

---

## MongoDB: Two Databases

- **shef-lms** – production (batches, users, videos, etc.)
- **shef-lms-dev** – dev (separate, can be reset anytime)

Use the same MongoDB cluster; only the database name changes.

### Clone production data to dev

To mirror production data into the dev database (e.g. for testing with real data):

```bash
cd backend
npm run clone:prod-to-dev
```

Or with explicit database names:

```bash
node scripts/cloneProdToDev.js --prod-db shef-lms --dev-db shef-lms-dev
```

Requires:
- `.env` – production MongoDB config
- `.env.dev` – dev MongoDB config with `MONGO_DB_NAME=shef-lms-dev` (or `MONGODB_DATABASE=shef-lms-dev`)

The script copies all collections from prod to dev. Dev collections are replaced; production is read-only.
