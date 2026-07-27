# Production checklist (Shef-LMS)

Use this when deploying or auditing the app on your VPS/Docker.

## Environment variables (backend)

- **`NODE_ENV=production`** – Enables production-only behavior (CORS strict, no universal password).
- **`JWT_SECRET`** – **Required** in production. Must be set; server will not start without it. Use a long random string (e.g. `openssl rand -base64 32`).
- **`ALLOWED_ORIGINS`** – Comma-separated list of frontend origins (e.g. `https://learnwithus.sbs,https://www.learnwithus.sbs`). Only these can call the API when `NODE_ENV=production`.
- **`MONGODB_*`** – Use MongoDB Atlas. Set `MONGODB_USERNAME`, `MONGODB_PASSWORD`, `MONGODB_CLUSTER`, `MONGODB_DATABASE` in .env.
- Do not commit `.env` or `.env.backup`; they are in `.gitignore`.

## Frontend build (production)

- Set **`REACT_APP_API_URL`** in `frontend/.env.production` to your production API URL (e.g. `https://learnwithus.sbs` or same domain). Do not use `http://localhost:5000` for production builds.
- Build with `npm run build` and serve the `build/` folder (e.g. via Nginx).

## Docker

- **MongoDB**: Consider not exposing port `27017` to the host in production. In `docker-compose.yml`, remove or comment out `ports: - "27017:27017"` for the mongo service if no external tool needs direct access. Backend connects via the Docker network.
- Ensure backend container has `NODE_ENV=production` and `JWT_SECRET` set (e.g. via `env_file: .env` and `environment: - NODE_ENV=production`).

## Security (already addressed in code)

- Universal password `Admin@123` (auto-create user / login fallback) is **disabled in production**; it only runs when `NODE_ENV !== 'production'`.
- CORS in production allows only origins listed in `ALLOWED_ORIGINS`.
- User list/search and mentor/teacher list API responses **exclude** the password field.
- Admin user update endpoint **ignores** `password` in the body (use a dedicated password-change flow).
- JWT signing uses `JWT_SECRET`; in production the server refuses to start if it is missing.
- Debug `console.log` removed from dashboard route and student Dashboard component.

## Implemented production features

- **Rate limiting**: `express-rate-limit` on `/api/auth` (default 50 requests per 15 min per IP; set `AUTH_RATE_LIMIT_MAX` to override).
- **Security headers**: `helmet` with safe defaults (CSP disabled for API).
- **HTTPS redirect**: In production, requests with `X-Forwarded-Proto: http` are redirected to HTTPS (use when app is behind Nginx/reverse proxy).
- **Structured logging**: Winston logger in `utils/logger.js`; used in server, auth, mongo, dashboard, roleAuth. Set `LOG_LEVEL` (e.g. `info`, `error`) to control verbosity.
