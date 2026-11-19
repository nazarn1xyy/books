#!/usr/bin/env bash
# Build locally, ship to the server, restart, migrate, smoke-test.
# Usage: deploy/deploy.sh            (from the repo root)
#        SKIP_CHECKS=1 deploy/deploy.sh
set -euo pipefail

SERVER="${SERVER:-ubuntu@79.76.50.187}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
REMOTE_DIR=/opt/libify
SITE=https://libify.store
TAG="$(git rev-parse --short HEAD)"
ssh_() { ssh -i "$SSH_KEY" -o BatchMode=yes "$SERVER" "$@"; }

cd "$(git rev-parse --show-toplevel)"

if [[ -z "${SKIP_CHECKS:-}" ]]; then
  echo "==> checks"
  npm run typecheck
  npm run lint
  npm test
fi

echo "==> build web"
npm run build -w @libify/web

echo "==> build api image libify-api:$TAG (linux/amd64)"
docker buildx build --platform linux/amd64 -f apps/api/Dockerfile -t "libify-api:$TAG" --load .

echo "==> upload image"
docker save "libify-api:$TAG" | gzip | ssh_ "gunzip | sudo docker load"

echo "==> upload web + config"
ssh_ "sudo mkdir -p $REMOTE_DIR/web $REMOTE_DIR/backups && sudo chown -R \$USER: $REMOTE_DIR"
rsync -az --delete -e "ssh -i $SSH_KEY" apps/web/dist/ "$SERVER:$REMOTE_DIR/web/"
rsync -az -e "ssh -i $SSH_KEY" deploy/docker-compose.yml deploy/Caddyfile deploy/backup.sh "$SERVER:$REMOTE_DIR/"

echo "==> migrate + restart"
ssh_ "set -euo pipefail; cd $REMOTE_DIR && test -f .env || { echo 'missing $REMOTE_DIR/.env'; exit 1; }
  sed -i '/^API_TAG=/d' .env && echo API_TAG=$TAG >> .env
  sudo docker compose up -d --wait db
  sudo docker compose run --rm --no-deps api node dist/migrate.js
  sudo docker compose up -d
  sudo docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || true
  sudo docker image prune -f >/dev/null"

echo "==> smoke test"
for i in $(seq 1 30); do
  if curl -fsS "$SITE/api/health" >/dev/null 2>&1; then break; fi
  sleep 2
done
curl -fsS "$SITE/api/health"; echo
curl -fsS -o /dev/null -w "web: %{http_code}\n" "$SITE/"
ssh_ "sudo docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}'"
echo "==> deployed $TAG"
