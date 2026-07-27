# Production-ready: what’s required vs what’s done

## Overview

| Category | What’s required for production | What’s already done (in code) | What you must do |
|----------|---------------------------------|-------------------------------|------------------|
| **Security** | No universal password, strict CORS, no JWT fallback, no passwords in API | ✅ All of these are implemented in code | Set env vars (see below) |
| **Config** | Correct env and frontend API URL | ✅ Code uses env; `.env.production` has a placeholder | Set `JWT_SECRET`, `ALLOWED_ORIGINS`, `NODE_ENV`; fix API URL if needed |
| **Deploy** | Build frontend, run backend with production env | — | Build, deploy, optional: hide MongoDB port |

---

## 1. Changes already done in the code (by me)

These are **code changes** that are already in the repo. They only take effect when you use the right config (especially `NODE_ENV=production` and `JWT_SECRET`).

| # | Change | Where |
|---|--------|--------|
| 1 | **JWT secret** – In production, server **requires** `JWT_SECRET` and refuses to start if it’s missing. No more hardcoded fallback in production. | `backend/middleware/auth.js`, `backend/middleware/roleAuth.js`, `backend/routes/auth.js` |
| 2 | **Universal password off in production** – Auto-create user and “login as anyone with Admin@123” only run when `NODE_ENV !== 'production'`. | `backend/routes/auth.js` |
| 3 | **CORS** – In production, only origins in `ALLOWED_ORIGINS` are allowed; all others are rejected. | `backend/server.js` |
| 4 | **Passwords not sent in API** – User/mentor/teacher list and search responses no longer include the `password` field. | `backend/routes/admin.js` (users, users/search, mentors, teachers) |
| 5 | **Admin user update** – `PUT /api/admin/users/:id` no longer accepts or saves `password` from the body. | `backend/routes/admin.js` |
| 6 | **User search** – Search string is escaped before use in MongoDB `$regex` to avoid regex injection. | `backend/routes/admin.js` (users/search) |
| 7 | **Debug logs removed** – Removed `console.log` that exposed user/course/batch and token info. | `backend/routes/dashboard.js`, `frontend/src/components/Dashboard.js` |
| 8 | **.gitignore** – Ensures `.env`, `.env.backup`, and other env files (except examples) are not committed. | `.gitignore` |
| 9 | **Frontend production API URL** – `frontend/.env.production` set to `https://learnwithus.sbs` with a note; you can change the URL if your domain is different. | `frontend/.env.production` |

So: **production readiness in code is done**. What’s left is **your configuration and deployment**.

---

## 2. What you must do (required for production)

These are **not code changes**; they are **configuration and deployment steps** on your side.

### Backend environment (e.g. `backend/.env` or Docker env)

| Variable | What to do |
|----------|------------|
| **`NODE_ENV`** | Set to `production` so CORS and “no universal password” and “JWT required” apply. |
| **`JWT_SECRET`** | **Required.** Set to a long random string (e.g. `openssl rand -base64 32`). Without it, the server will not start in production. |
| **`ALLOWED_ORIGINS`** | Set to your real frontend URL(s), comma-separated, e.g. `https://learnwithus.sbs,https://www.learnwithus.sbs`. |
| **`MONGODB_*`** | Use MongoDB Atlas: set `MONGODB_USERNAME`, `MONGODB_PASSWORD`, `MONGODB_CLUSTER`, `MONGODB_DATABASE` in .env. |

### Frontend

| Item | What to do |
|------|------------|
| **`REACT_APP_API_URL`** | In `frontend/.env.production` it’s set to `https://learnwithus.sbs`. If your production URL is different, change it there before building. |
| **Build** | Run `npm run build` in the frontend and serve the `build/` folder (e.g. via Nginx). |

### Docker (recommended)

| Item | What to do |
|------|------------|
| **Backend env** | Ensure the backend container gets `NODE_ENV=production` and `JWT_SECRET` (via `env_file: .env` and/or `environment` in docker-compose). |
| **MongoDB port** | Optional but recommended: in production, do not expose `27017` on the host (remove or comment `ports: - "27017:27017"` for the mongo service) so only the backend can reach MongoDB. |

### After changing config

- Rebuild the backend Docker image (if you use Docker) and restart containers.
- Rebuild the frontend with the correct `REACT_APP_API_URL` and deploy the new `build/`.

---

## 3. Additional production features (done in code)

These would make production even safer/better but are **not required** for “production ready” as we defined it:

- **Rate limiting** – Done: `/api/auth` limited per IP (default 50/15 min). Set `AUTH_RATE_LIMIT_MAX` to override. (e.g. `express-rate-limit`) to limit brute force.
- **Security headers** – Done: `helmet` applied (CSP disabled for API).
- **HTTPS only** (Nginx + certificate, e.g. Let’s Encrypt).
- **Structured logging** – Done: Winston logger in `utils/logger.js`; used in server, auth, mongo, dashboard, roleAuth. Set `LOG_LEVEL` (e.g. `info`) to control.

---

## Quick checklist for you

- [ ] Set `NODE_ENV=production` for the backend (e.g. in `backend/.env` or Docker).
- [ ] Set `JWT_SECRET` to a long random value (backend env).
- [ ] Set `ALLOWED_ORIGINS` to your frontend URL(s) (backend env).
- [ ] Confirm `REACT_APP_API_URL` in `frontend/.env.production` matches your production domain; rebuild frontend.
- [ ] Rebuild/restart backend (and optionally hide MongoDB port in docker-compose for production).

Once these are done, the app is production-ready from a security and config standpoint.
