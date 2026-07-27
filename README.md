# Sky States LMS (Shef-LMS)

Learning management system for **Data Science & AI** and **Cyber Security** programs.

## Layout

```text
Shef-LMS/
  backend/          # Express API (Docker)
  frontend/         # React app (CRA)
  scripts/          # Deploy / ops scripts
  docs/             # Architecture and ops docs
  content/
    course-notebooks/
      data-science-ai/   # Jupyter notebooks by module
  .github/          # CI/CD
```

## Environments

| | Production | DEV |
|---|---|---|
| Site | `learnwithus.sbs` | `dev.learnwithus.sbs` |
| Backend | port 5000 (`shef-lms-backend`) | port 5001 (`shef-lms-backend-dev`) |
| DB | `lms` | `shef-lms-dev` |
| Branch | `main` | `develop` |

Deploy: `./scripts/deploy-dev.sh` or `./scripts/deploy-production.sh`.

## Data Science notebooks

Notebooks live under `content/course-notebooks/data-science-ai/`. They are mounted into the backend container and seeded as Resources:

```bash
cd backend
npm run seed:ds-notebooks:dev   # DEV DB
npm run seed:ds-notebooks       # production DB (careful)
```

Students with `resourcesEnabled` on a Data Science batch see them under **Resources** and can download `.ipynb` files via authenticated API.

## Docs

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and other files in `docs/`.
