# Google Meet + Drive recordings on DEV (no service account keys)

Live classes on `dev.learnwithus.sbs` create Google Calendar events with Meet links. After class, trainers upload the recording to **Google Drive** (per-batch folder); a Classroom lecture is created with `videoSource: 'drive'`.

## Why not a service account JSON key?

Many orgs enforce:

```text
iam.disableServiceAccountKeyCreation
```

That blocks downloading SA keys. **Use OAuth instead** (refresh token for one Workspace host user). Same Calendar API + Meet `conferenceData` flow, plus Drive uploads; no domain-wide delegation required.

---

## Recommended: OAuth (host user)

### 1) Google Cloud

1. Create/select a GCP project
2. Enable **Google Calendar API** and **Google Drive API**
3. **APIs & Services → OAuth consent screen**
   - User type: Internal (Workspace) if available, else External for testing
   - Add scopes:
     - `https://www.googleapis.com/auth/calendar.events`
     - `https://www.googleapis.com/auth/drive.file`
4. **Credentials → Create credentials → OAuth client ID**
   - Application type: **Desktop app** (simplest), or Web with redirect `http://localhost:5000/auth/google/callback`
   - Copy Client ID + Client Secret

### 2) Put client credentials in `backend/.env.dev`

```bash
GOOGLE_MEET_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_MEET_CLIENT_SECRET=GOCSPX-...
GOOGLE_MEET_REDIRECT_URI=http://localhost:5000/auth/google/callback
GOOGLE_CALENDAR_ID=primary
GOOGLE_MEET_HOST_EMAIL=admin@lms.skystates.us
GOOGLE_DRIVE_ROOT_FOLDER=Sky States LMS Recordings
GOOGLE_DRIVE_SHARE_DOMAIN=skystates.us
GOOGLE_MEET_ENABLED=false
```

### 3) Get a refresh token (once — re-run if scopes change)

On the server (DEV backend must be up so the callback page works, or use the printed URL + code):

```bash
cd /root/Shef-LMS/backend
ENV_PATH=.env.dev node scripts/setup-meet-oauth.js
```

- Open the printed URL
- Sign in as the **host mailbox** that should own Meet events and Drive files (e.g. `admin@lms.skystates.us`)
- Grant **Calendar** and **Drive** access
- Paste the code back into the script
- Copy `GOOGLE_MEET_REFRESH_TOKEN=...` into `.env.dev`
- Set `GOOGLE_MEET_ENABLED=true`

**Important:** If you previously authorized Calendar-only, re-run this script so the refresh token includes `drive.file`.

### 4) Restart DEV backend + rebuild frontend

```bash
cd /root/Shef-LMS/backend
docker compose -p shef-lms-dev -f docker-compose.dev.yml up -d --build
# Frontend (DEV static): build and sync to /var/www/shef-lms-dev as usual
```

### 5) Smoke

- Admin/Teacher → Schedule Meet class → Meet link appears
- Host calendar shows the event
- Student in that batch sees **Join class**
- After the session window ends → **Upload to Google Drive** → file appears under `Sky States LMS Recordings / <batch>`
- Students see the lecture in Classroom and can play via Drive preview

---

## Optional: Service account + domain-wide delegation

Only if an **Organization Policy Admin** can allow SA key creation (or you use Workload Identity on GCP). Not required for DEV when OAuth works.

```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_WORKSPACE_IMPERSONATE=classes@yourdomain.com
```

If both OAuth and SA are set, **OAuth wins**.

---

## API

- `POST /api/meetings` — schedule (teacher/admin)
- `GET /api/meetings` — list (role-scoped)
- `GET /api/meetings/:id`
- `POST /api/meetings/:id/cancel`
- `POST /api/meetings/:id/join` — student join + attendance Present
- `POST /api/meetings/:id/start` / `complete`
- `GET|PATCH /api/meetings/:id/attendance`
- `POST /api/meetings/:id/recording` — multipart `recording` → Drive upload + Classroom lecture
- `GET /api/meetings/needing-recording`
- `GET /api/meetings/status` — `{ enabled, configured, authMode: oauth|service_account|none }`

---

## Attendance alerts

| Env | Default | Meaning |
|-----|---------|---------|
| `ATTENDANCE_ALERT_THRESHOLD` | `70` | Trainer can intimate students below this join % |
| `ATTENDANCE_STREAK_ALERT` | `3` | Consecutive absences → admin email |
| `ADMIN_ALERT_EMAILS` | (all admins) | Comma-separated admin inboxes for streak alerts |

Daily job: `backend/jobs/attendanceAlerts.js` (09:00 IST). Deduped via `ActivityLog` action `ATTENDANCE_STREAK_ALERT`.

## YouTube vs Drive

Older classroom lectures stay as **YouTube URLs** in Mongo. New Meet recordings upload to **Google Drive** under the Meet host account. The LMS does **not** mirror historical YouTube videos into Drive.

Trainer **batch materials / projects** and **per-session handouts** also use the same Meet/Drive OAuth host (`drive.file`) under each batch folder.

## Notes

- DEV only until promoted; keep prod `GOOGLE_MEET_ENABLED=false` until approved.
- Students open the Meet URL in a new tab (no iframe).
- Drive files are shared as link-readable (`anyone` reader, falling back to Workspace domain).
- Refresh tokens can be revoked in Google Account → Security → Third-party access; re-run the setup script if that happens.
