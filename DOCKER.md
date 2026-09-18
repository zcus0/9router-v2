# Docker

Run 9Router in a container. Published image: [`zcus0/9router-v2`](https://hub.docker.com/r/zcus0/9router-v2) — multi-platform `linux/amd64` + `linux/arm64`.

---

# 👤 For Users

## Quick start

```bash
docker run -d \
  -p 20135:20135 \
  -v "$HOME/.9router-v2:/app/data" \
  -e DATA_DIR=/app/data \
  --name 9router-v2 \
  zcus0/9router-v2:latest
```

App listens on port `20135`. Open: http://localhost:20135

## Manage container

```bash
docker logs -f 9router-v2        # view logs
docker stop 9router-v2           # stop
docker start 9router-v2          # start again
docker rm -f 9router-v2          # remove
```

## Data persistence

```bash
-v "$HOME/.9router-v2:/app/data" \
-e DATA_DIR=/app/data
```

Without `DATA_DIR`, the app falls back to `~/.9router-v2/` (macOS/Linux) or `%APPDATA%\9router-v2\` (Windows). In the container, `DATA_DIR=/app/data` makes the bind mount work.

Data layout under `$DATA_DIR/`:

```text
$DATA_DIR/
├── db/
│   ├── data.sqlite       # main SQLite database
│   └── backups/          # auto backups
└── ...                   # certs, logs, runtime configs
```

Host path: `$HOME/.9router-v2/db/data.sqlite`
Container path: `/app/data/db/data.sqlite`

## Optional env vars

```bash
docker run -d \
  -p 20135:20135 \
  -v "$HOME/.9router-v2:/app/data" \
  -e DATA_DIR=/app/data \
  -e PORT=20135 \
  -e HOSTNAME=0.0.0.0 \
  -e DEBUG=true \
  --name 9router-v2 \
  zcus0/9router-v2:latest
```

## Optional Headroom sidecar

The 9Router image does not bundle Python or Headroom. To use Headroom in Docker, run it as a separate service and point 9Router at that proxy:

```yaml
services:
  9router-v2:
    image: zcus0/9router-v2:latest
    ports:
      - "20135:20135"
    volumes:
      - "$HOME/.9router-v2:/app/data"
    environment:
      DATA_DIR: /app/data
      HEADROOM_URL: http://headroom:8787
    depends_on:
      - headroom

  headroom:
    image: ghcr.io/chopratejas/headroom:latest
    ports:
      - "8787:8787"
```

In the dashboard, open `Endpoint` → `Token Saver` → `Headroom`, confirm the URL is `http://headroom:8787`, recheck status, then enable Headroom.

If Headroom runs on the Docker host instead of as a sidecar, use `http://host.docker.internal:8787` on macOS/Windows. On Linux, add `--add-host=host.docker.internal:host-gateway` or the equivalent compose `extra_hosts` entry.

## Update to latest

```bash
docker pull zcus0/9router-v2:latest
docker rm -f 9router-v2
# re-run the quick start command
```

---

# 🛠 For Developers

## Build image locally (test)

```bash
docker build -t zcus0/9router-v2 .

docker run --rm -p 20135:20135 \
  -v "$HOME/.9router-v2:/app/data" \
  -e DATA_DIR=/app/data \
  zcus0/9router-v2
```

## Publish (automatic via CI)

Push a git tag `v*` → GitHub Actions builds multi-platform (amd64+arm64) and pushes to:
- `ghcr.io/zcus0/9router-v2:v{version}` + `:latest`
- `zcus0/9router-v2:v{version}` + `:latest`

```bash
# Use scripts/release.js (recommended)
node scripts/release.js "Release title" "Notes"

# Or manually
git tag v0.4.x && git push origin v0.4.x
```

Workflow: `.github/workflows/docker-publish.yml`