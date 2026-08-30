# Zoom live classes + recording pipeline (DEV)

## Live platforms

| Flag | Effect |
|------|--------|
| `ZOOM_ENABLED=true` | Zoom live sessions + S2S OAuth |
| `GOOGLE_MEET_ENABLED=false` | Meet live sessions **off** (default for Zoom-only rollout) |
| Admin → **Live classes** → Enable/Disable Google Meet | Runtime override of Meet (stored in `appsettings`) |
| `ZOOM_RECORDING_SYNC_ENABLED=true` | After class: Zoom cloud → Drive archive → **YouTube** → Classroom |
| `ZOOM_EMBEDDED_ENABLED=true` | Join stays in LMS via Meeting SDK (`/live/:id`) |

When Meet is off, trainers cannot create Meet rooms; Meet recording sync is skipped. Drive OAuth still works for Zoom archives.

## Recording flow (Zoom)

1. Zoom meeting created with `auto_recording: cloud`
2. Cron every 10 min (or trainer **Sync Zoom recordings → YouTube**)
3. Download MP4 from Zoom API
4. Upload to batch Google Drive folder (archive)
5. Upload to YouTube (`YOUTUBE_PRIVACY_STATUS=unlisted` recommended)
6. Classroom lecture set to `videoSource: youtube-url` — student/trainer player uses YouTube

## Env (DEV `backend/.env.dev`)

```bash
ZOOM_ENABLED=true
ZOOM_ACCOUNT_ID=...
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
ZOOM_DEFAULT_USER_ID=abhishekparihar@skystates.us
ZOOM_RECORDING_SYNC_ENABLED=true
ZOOM_EMBEDDED_ENABLED=true
ZOOM_MEETING_SDK_KEY=...
ZOOM_MEETING_SDK_SECRET=...

GOOGLE_MEET_ENABLED=false
GOOGLE_MEET_CLIENT_ID=...
GOOGLE_MEET_CLIENT_SECRET=...
GOOGLE_MEET_REFRESH_TOKEN=...

YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_REFRESH_TOKEN=...
YOUTUBE_PRIVACY_STATUS=unlisted
```

## Zoom S2S scopes

Meeting create / manage:

- `meeting:write:admin`, `meeting:read:admin`, `user:read:admin`

Recordings (required for Zoom → Drive → YouTube):

- `cloud_recording:read:list_recording_files:admin`
- `cloud_recording:read:recording:admin`
- `cloud_recording:read:list_user_recordings:admin` (or `cloud_recording:read:list_user_recordings`)

**In-LMS host (required for trainer embedded host):**

- `user:read:token:admin` (or `user:read:token`)

**Trainer provisioning (optional, for auto-create Zoom users):**

- `user:read:list_users:admin`, `user:read:user:admin`, `user:write:user:admin`

**Native PMI enablement (optional — without these, LMS uses a stable type-3 recurring room per trainer):**

- `user:update:settings:admin` (or `user:update:settings`)
- `user:read:settings:admin` (or `user:read:settings`)

Without the token scope, trainers cannot get a ZAK host token and the LMS falls back to participant mode.
Without recording scopes, live classes still work but cloud recording sync will fail until scopes are added and the app is re-activated.

## In-meeting chat

Chat is controlled by **Zoom account settings** first, then the Meeting SDK (`isSupportChat: true` in the LMS).

1. Zoom web portal → **Account Management** → **Account Settings** → **Meeting** tab.
2. Under **In Meeting (Basic)**, turn **Meeting chat** **ON**.
3. Set **By default, allow participants to chat with** → **Everyone** (public and private).
4. Save. Hosts can still restrict chat during a live session from the Zoom toolbar.

Optional API scopes if you want the LMS to push chat defaults per user/meeting:

- `account:read:settings:admin`, `account:update:settings:admin`
- `user:read:settings:admin`, `user:update:settings:admin`
- `meeting:update:meeting:admin`

## Meeting SDK app

Separate from S2S OAuth. In Marketplace → Meeting SDK → **Domains**, add:

- `dev.learnwithus.sbs`
- `learnwithus.sbs`

## YouTube OAuth

Same GCP client as Meet is fine. Needs `youtube.upload` via `scripts/setup-youtube-oauth.js`.

## Trainer Zoom user IDs

Admin → Teachers → Zoom + Zoom user ID, or:

`ENV_PATH=.env.dev node scripts/setTrainerZoomIds.js --file=scripts/trainers-zoom.dev.json`

## Smoke test

1. `bash scripts/deploy-dev.sh`
2. Add S2S scope `user:read:token:admin` and activate
3. Trainer starts Zoom class → stays on `/live/...`
4. Student joins from dashboard → in-LMS classroom
5. After class, **Sync Zoom recordings → YouTube**
