# Shef-LMS Testing Checklist

## 1. IP/Geo Fix (Delhi/Noida for US students)

**Cause:** Backend was likely receiving proxy IP or wrong headers. Now supports:
- `CF-Connecting-IP` (Cloudflare)
- `True-Client-IP` (Akamai)
- `X-Forwarded-For` (leftmost = client)
- `X-Real-IP` (Nginx)

**Verify:**
1. As admin, open: `https://yoursite.com/api/admin/debug-ip` (with auth header)
2. Check `clientIP` and `geo` – should match your actual location
3. Have a US-based user login; check Activity log – should show US location

**If using Cloudflare:** Ensure Nginx passes `CF-Connecting-IP`:
```nginx
proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;
```
Run: `sudo bash scripts/update-nginx-cache-headers.sh`

---

## 2. Cache Fixes (users needing to refresh)

**Changes:**
- Service worker: API requests **never cached**; HTML **network-first**
- AdminDashboard: Cache reduced 5min → 90sec
- API responses: `Cache-Control: no-store`
- index.html: `Cache-Control: no-cache` (via Nginx)

**Verify:**
1. Deploy new build
2. Open app in browser (no hard refresh)
3. Make a change (e.g. add student) in another tab
4. Switch back – data should update within 90 sec or on Refresh
5. Students: after deploy, they should get new app without hard refresh

**Apply Nginx changes on live server:**
```bash
sudo bash scripts/update-nginx-cache-headers.sh
```

---

## 3. UI/Mapping Checks

- **Students in batch:** BatchDetailsPage → Students tab – list matches User.batchId
- **Videos per batch:** Classroom videos show for correct batch/course
- **Course filters:** Add-student modal shows correct batches for selected course
- **Login Activity:** Activity section shows correct user, time, IP, location

---

## 4. Quick Smoke Test

| Action | Expected |
|--------|----------|
| Login as student | Redirect to dashboard, videos load |
| Login as admin | Admin dashboard, sections load |
| Add student | Appears in list, no refresh needed (within 90s) |
| Edit student | Changes persist, Login Activity shows if exists |
| View Activity | Logins and video views appear |
| Deploy frontend | Users get new version without hard refresh |
