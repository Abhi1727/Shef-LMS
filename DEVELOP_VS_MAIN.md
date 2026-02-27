# Develop vs Main – Differences Summary

**Last updated:** After fetching latest from `origin/develop`

---

## Commits on `develop` (not in `main`)

| Commit   | Author    | Description |
|----------|-----------|-------------|
| 1082cda  | ayush8433 | Mobile responsiveness (Dashboard, AdminDashboard, Login, CSS) |
| b4cc3c5  | ayush8433 | One-to-one batch management (backend + frontend) |
| 86d7718  | ayush8433 | Deployment trigger / env config |
| f5acf6c  | ayush8433 | deploy-dev-fixed.sh, deploy-via-ssh updates |
| 0f8bbdc  | root      | OneToOneCourseSelectionFallback component |
| 4da0a9f  | root      | 1:1 batch API – repository, routes, server mount |
| b57097f  | ayush8433 | Email service config for batch emails |

---

## Files Changed (29 files, ~7.7k lines)

### Backend
| File | Change |
|------|--------|
| `backend/controllers/oneToOneBatchController.js` | **NEW** – 1:1 batch CRUD |
| `backend/models/OneToOneBatch.js` | **NEW** – schema |
| `backend/models/User.js` | +`oneToOneBatchId` field |
| `backend/repositories/oneToOneBatchRepository.js` | **NEW** – data layer |
| `backend/routes/oneToOneBatches.js` | **NEW** – API routes |
| `backend/server.js` | +mount `/api/one-to-one-batches` |
| `backend/.env.example` | +email config |

### Frontend
| File | Change |
|------|--------|
| `OneToOneBatchManagement.js` | **NEW** – 1429 lines |
| `OneToOneCourseSelection.js` | **NEW** – 1052 lines |
| `OneToOneCourseSelectionFallback.js` | **NEW** |
| `oneToOneBatchService.js` | **NEW** |
| `AdminDashboard.js/css` | 1:1 nav, styling |
| `Dashboard.js/css` | Responsive updates |
| `Login.css` | Styling |
| `StudentProfile.js` | Refactors |
| `StudentsActivity.js/css` | Updates |
| `MentorDashboard.js` | Minor |
| `App.js` | +1:1 route |

### DevOps / Scripts
| File | Change |
|------|--------|
| `.github/scripts/deploy-via-ssh.sh` | Use `$SCRIPT` param |
| `scripts/deploy-dev-fixed.sh` | **NEW** – auto-create env files |
| `scripts/deploy-dev.sh` | +REACT_APP_API_URL, +create-admin step |
| `DEPLOYMENT_TRIGGER.md` | **NEW** |

---

## Avoiding Merge Conflicts

1. **Merge main into develop** before merging develop → main:
   ```bash
   git checkout develop && git pull origin develop
   git merge main
   # Fix conflicts if any
   git push origin develop
   ```

2. **Merge develop into main** when ready for production:
   ```bash
   git checkout main && git pull origin main
   git merge develop
   git push origin main
   ```

3. **Conflicts to watch:**
   - `backend/server.js` – route mounts
   - `frontend/src/App.js` – routes
   - `package.json` – scripts

---

## Dev Login Fix (admin@sheflms.com / SuperAdmin@123)

If you cannot log in on **dev.learnwithus.sbs**:

1. **Ensure `.env.dev` on VPS** includes:
   ```
   ALLOWED_ORIGINS=https://dev.learnwithus.sbs,https://learnwithus.sbs,...
   FRONTEND_URL=https://dev.learnwithus.sbs
   BACKEND_URL=https://dev.learnwithus.sbs/api
   ```

2. **Ensure admin exists in dev DB:**
   ```bash
   cd /root/Shef-LMS/backend
   npm run create-admin:dev
   ```

3. **Restart dev backend:**
   ```bash
   docker compose -p shef-lms-dev -f docker-compose.dev.yml up -d --build
   ```

4. **Clear browser cache/cookies** for dev.learnwithus.sbs and try again.
