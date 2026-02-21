# CI/CD Pipeline Setup

Automatically deploy to **dev.learnwithus.sbs** when code is pushed to the `develop` branch.

---

## Prerequisites

- VPS with the repo cloned at `/root/Shef-LMS`
- GitHub repo with the code
- SSH access to the VPS as `root` (or another user with sudo)

---

## Step 1: Create the `develop` branch (if it doesn't exist)

```bash
cd /root/Shef-LMS
git checkout -b develop
git push -u origin develop
```

---

## Step 2: Generate SSH deploy key on the VPS

SSH into your VPS and run:

```bash
cd /root/Shef-LMS
chmod +x scripts/setup-github-deploy-key.sh
./scripts/setup-github-deploy-key.sh
```

This will:
- Create `~/.ssh/github_deploy` and `~/.ssh/github_deploy.pub`
- Add the public key to `~/.ssh/authorized_keys`
- Print the **private key** for you to copy

---

## Step 3: Add GitHub Secrets

1. Go to your repo on GitHub: **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add:

| Secret name   | Value                                      |
|---------------|--------------------------------------------|
| `VPS_HOST`    | Your VPS IP address only (e.g. `31.220.55.193`) — no `https://`, no port, no path |
| `VPS_USER`    | SSH username (e.g. `root`)                 |
| `VPS_SSH_KEY` | Paste the **entire private key** from Step 2 (from `-----BEGIN OPENSSH PRIVATE KEY-----` to `-----END OPENSSH PRIVATE KEY-----`) |

---

## Step 4: Ensure the repo is set up on the VPS

On the VPS, the repo must have `origin` pointing to GitHub:

```bash
cd /root/Shef-LMS
git remote -v
# Should show origin → https://github.com/YOUR_USER/Shef-LMS.git (or similar)
```

If not, add it:

```bash
git remote add origin https://github.com/YOUR_USER/Shef-LMS.git
# Or with SSH: git@github.com:YOUR_USER/Shef-LMS.git
```

---

## Step 5: Test the pipeline

1. Make a small change (e.g. edit `README.md`)
2. Commit and push to `develop`:
   ```bash
   git checkout develop
   git add .
   git commit -m "Test CI/CD pipeline"
   git push origin develop
   ```
3. Go to **GitHub** → **Actions** in your repo
4. You should see "Deploy to Dev" running
5. When it completes, check **https://dev.learnwithus.sbs**

---

## Workflow summary

| Event                    | Action                                    |
|--------------------------|-------------------------------------------|
| Push to `develop`        | GitHub Actions SSHs to VPS, pulls code, runs `./scripts/deploy-dev.sh` |
| Result                   | dev.learnwithus.sbs is updated            |

---

## Troubleshooting

### "Host key verification failed"
Add your VPS host fingerprint as a secret:
```bash
ssh -v root@YOUR_VPS_IP 2>&1 | grep "Offering public key"
# Or: ssh-keyscan YOUR_VPS_IP
```
Then add `VPS_FINGERPRINT` secret and use `fingerprint: ${{ secrets.VPS_FINGERPRINT }}` in the workflow.

### "command not found" (npm, docker, node)
The SSH session may not load your shell profile. Ensure Node and Docker are in the default `PATH` (e.g. `/usr/local/bin`). If you use `nvm`, consider switching to a system-wide Node install for the deploy user.

### Permission denied (publickey)
- Verify `VPS_SSH_KEY` contains the full private key including BEGIN/END lines
- Ensure the public key is in `~/.ssh/authorized_keys` on the VPS
- Check `VPS_USER` and `VPS_HOST` are correct

### Wrong project path
If your repo is not at `/root/Shef-LMS`, edit `.github/workflows/deploy-dev.yml` and change the `cd` path in the script.

