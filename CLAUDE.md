@AGENTS.md

## Deployment Environment

- App runs inside **Docker container** (`udemy-app`), NOT directly on host
- Port mapping: `localhost:3939 → container:3000`
- Source code is **baked into the image** (not volume-mounted), so code changes require **rebuild**:
  ```bash
  docker compose up -d --build udemy-app
  ```
- `localhost:3000` is a DIFFERENT app (`goclaw-ui`), not udemy-app
- Docker compose file: `docker-compose.yml`, Dockerfile: `Dockerfile`
- Data volume: `udemy-app_udemy-data` mounted at `/app/data`
