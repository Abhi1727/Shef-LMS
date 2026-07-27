# Migrate from Local MongoDB (Docker) to MongoDB Atlas

Use this guide to shift the Shef LMS backend from local MongoDB (Docker) to MongoDB Atlas.

---

## Prerequisites

- MongoDB Atlas account: https://cloud.mongodb.com
- Existing Firebase credentials (for any Firebase-to-MongoDB migration)

---

## Step 1: Create MongoDB Atlas Cluster

1. Log in at [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a cluster (e.g. M0 free tier)
3. Create a database user: **Database Access** → **Add New Database User**
4. Add IP allowlist: **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`) or add your IP
5. Get the connection string: **Database** → **Connect** → **Connect your application** → copy the URI

---

## Step 2: Update `backend/.env`

Replace the old MongoDB configuration with your Atlas connection string:

```env
# Option 2 (recommended – no placeholders in .env):
MONGODB_USERNAME=your_atlas_username
MONGODB_PASSWORD=your_atlas_password
MONGODB_CLUSTER=cluster0.xxxxx.mongodb.net
MONGODB_DATABASE=lms

# Or Option 1 – full connection string (URL-encode special chars in password):
# MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/lms?retryWrites=true&w=majority
```

**Important:** If the password contains special characters (e.g. `@`, `#`, `:`, `/`), URL-encode them:
- `@` → `%40`
- `#` → `%23`
- `:` → `%3A`
- `/` → `%2F`

**Example:**
```env
# Password is "pass@123" → use pass%40123
MONGODB_URI=mongodb+srv://myuser:pass%40123@cluster0.abc123.mongodb.net/lms?retryWrites=true&w=majority&appName=Cluster0
```

---

## Step 3: Update `backend/config/mongo.js`

Ensure the mongo config supports SRV-to-standard conversion for networks that block `querySrv`. If the config does not include `srvToStandardUri`, add it so the backend can connect reliably on systems where SRV lookups fail.

The config should:
1. Prefer `MONGODB_URI_STANDARD` if set (for direct `mongodb://` connections)
2. Otherwise use `MONGODB_URI` (e.g. `mongodb+srv://`)
3. When using `mongodb+srv://`, convert to standard format using Node's `dns` module and fall back to Google DNS (8.8.8.8) if system DNS fails

---

## Step 4: Update `backend/docker-compose.yml` (Optional)

If you no longer run the backend in Docker with local Mongo, you can:

**Option A – Remove MongoDB from Docker**

Remove the `mongo` service and update `backend` to use `.env` instead of hardcoded MongoDB:

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: shef-lms-backend
    ports:
      - "5000:5000"
    env_file:
      - .env
    # Remove: environment: MONGODB_URI=...
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    networks:
      - shef-lms-network

# Remove the mongo service entirely

networks:
  shef-lms-network:
    driver: bridge
```

**Option B – Keep both**

Leave `docker-compose.yml` as-is. When running locally with `npm start`, the backend uses `backend/.env`, which should contain the Atlas URI. Docker Compose overrides `.env` only when you run `docker-compose up`.

---

## Step 5: Migrate Data from Local Docker MongoDB to Atlas

Before switching, export your existing data from the local MongoDB container and import it into Atlas:

**1. Export from local MongoDB (if you have one)**
```bash
# If using local mongo container: mongodump --uri=mongodb://localhost:27017 --out=./mongo-dump
# Or from another source – adjust as needed
```

**2. Import into Atlas**
```bash
# Install mongodb-database-tools if needed (or use Docker)
# mongorestore "mongodb+srv://USER:PASS@cluster.mongodb.net/" --db shef-lms ./mongo-dump/shef-lms
mongorestore --uri="mongodb+srv://USER:PASS@cluster.mongodb.net/?retryWrites=true&w=majority" --db shef-lms ./mongo-dump/shef-lms
```

Replace `USER`, `PASS`, and `cluster.mongodb.net` with your Atlas credentials. If the database name differs, adjust `--db` and the dump path accordingly.

**3. Verify in Atlas**
- Atlas → Database → Browse Collections
- Confirm your collections (users, batches, classrooms, etc.) are present

---

## Step 6: Migrate Data from Firebase (if needed)

If you have data in Firebase Firestore and want it in Atlas:

1. Add Firebase credentials to `backend/.env`:
   ```env
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=your-service-account-email
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

2. Run the migration:
   ```bash
   cd backend
   npm run migrate:firebase
   ```

---

## Step 7: Verify

1. Start the backend: `cd backend && npm start` (or `docker compose up -d`)  
   Expected: `MongoDB connected` and `Server running on port 5000`

2. Test health: `http://localhost:5000/api/health`  
   Expected: `{"status":"ok"}`

3. Start the frontend: `cd frontend && npm start`  
   Expected: app at `http://localhost:3000` with backend at `http://localhost:5000`

---

## Summary of Changes

| File / Area        | Change                                                    |
|--------------------|-----------------------------------------------------------|
| `backend/.env`     | Replace `MONGODB_URI` with Atlas connection string        |
| `backend/config/mongo.js` | Add SRV-to-standard conversion with DNS fallback   |
| `backend/docker-compose.yml` | Remove `mongo` service or point backend to Atlas   |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `querySrv ECONNREFUSED` | Ensure mongo config uses SRV-to-standard conversion + Google DNS fallback |
| `Server selection timed out` / IP not whitelisted | Check Atlas Network Access, add `0.0.0.0/0` or your VPS IP |
| Connection works from host but fails in Docker | Use `network_mode: host` in docker-compose so the container uses the host network |
| Password with `@` breaks URI | URL-encode: `@` → `%40` |

**Test connection:** `cd backend && node scripts/test-atlas-connection.js`
