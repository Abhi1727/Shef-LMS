# Sky States LMS – Architecture

## Stack

- **Frontend:** React SPA (CRA), static build served by nginx
- **Backend:** Node.js + Express in Docker (`network_mode: host` for Atlas)
- **Database:** MongoDB Atlas (no local MongoDB)
- **Auth:** JWT + bcrypt

## Repo layout

| Path | Role |
|------|------|
| `backend/` | API, models, routes, Docker compose |
| `frontend/` | Student / teacher / admin UI |
| `content/course-notebooks/` | Course materials (DS notebooks) |
| `scripts/` | Deploy and ops wrappers |
| `docs/` | Design and ops documentation |

Internal route/component trees under `backend/routes` and `frontend/src/components` are left in place for stability.

## Environments

- **Production:** branch `main`, DB `lms`, port 5000, FE `/var/www/shef-lms`
- **DEV:** branch `develop`, DB `shef-lms-dev`, port 5001, FE `/var/www/shef-lms-dev`

Backend env files: `backend/.env` (prod), `backend/.env.dev` (dev). Course content is volume-mounted at `/app/content` (`CONTENT_ROOT`).

## Resources & notebooks

- Models: `Resource`, `ResourceCategory`
- Students: `GET /api/resources` when batch has `resourcesEnabled` and matching `resourceUniverse`
- Notebooks: `resourceType: 'notebook'`, files under `content/course-notebooks/data-science-ai/`
- Download: `GET /api/resources/download/:slug` (authenticated)
- Seed (idempotent): `backend/scripts/seed-ds-notebooks.js`

## Maintenance

```bash
cd backend
npm run create-admin
npm run seed:ds-notebooks:dev
npm run sync:batches
```

Prefer `docker exec shef-lms-backend …` for production DB ops so host `ENV_PATH` does not accidentally hit DEV.

## Deployment

1. Configure Atlas credentials and JWT in the correct `.env` file
2. Whitelist server IP in Atlas Network Access
3. `./scripts/deploy-dev.sh` or `./scripts/deploy-production.sh`
