# Continue this LMS work on another Mac (Cursor)

Chat history on this VM does **not** automatically appear on your Mac. Use Git + the project rule below so the new Cursor session still knows the important context.

## 1. On your Mac

```bash
git clone https://github.com/Sky-States/LMS.git
cd LMS
git checkout develop
```

Open that folder in Cursor (same Cursor account is fine; what matters is opening **this repo**).

## 2. Context the new chat will see

This repo includes an always-on Cursor rule:

- [`.cursor/rules/sky-states-lms-handoff.mdc`](../.cursor/rules/sky-states-lms-handoff.mdc)

In a **new Agent chat** on the Mac, start with something like:

> Read `.cursor/rules/sky-states-lms-handoff.mdc` and `docs/FIRESTORE_DEV_RUNTIME.md`. Continue from the DEV Firestore cutover — DEV uses Firestore, prod stays on Mongo.

You can also **@**-mention those files in chat.

## 3. Optional: bring a past chat summary

On the Linux server, agent transcripts live under Cursor’s project folder (not in git). If you need a specific prior decision, paste a short summary into the Mac chat or into this doc.

Useful docs already in git:

- [`docs/FIRESTORE_DEV_RUNTIME.md`](FIRESTORE_DEV_RUNTIME.md) — DEV Firestore flag + rollback
- [`docs/GOOGLE_MEET_DEV_SETUP.md`](GOOGLE_MEET_DEV_SETUP.md) — Meet/Drive OAuth

## 4. Secrets (not in git)

Copy locally (do not commit):

- `backend/.env` (prod)
- `backend/.env.dev` (DEV, includes `USE_FIRESTORE` + Google OAuth tokens)

Ask whoever has server access to securely transfer those files (scp / 1Password / etc.).

## 5. Remotes after clone

```text
origin  → https://github.com/Sky-States/LMS.git   (primary)
```

The server also keeps a legacy remote name `abhi` → `Abhi1727/Shef-LMS`; you do not need that on the Mac unless you still push to the personal repo.

## Current state (as of handoff)

| Item | State |
|------|--------|
| Code on GitHub | `Sky-States/LMS` branch `develop` |
| DEV data store | Firestore `skystateslms` when `USE_FIRESTORE=true` |
| PROD data store | Mongo Atlas `lms` (unchanged) |
| Meet/Drive | Working on DEV with manual recording upload |
