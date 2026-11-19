#!/usr/bin/env bash
# Daily Postgres dump, keeps the last 7. Installed by cron on the server:
#   15 3 * * * /opt/libify/backup.sh >> /opt/libify/backups/backup.log 2>&1
set -euo pipefail
cd /opt/libify
file="backups/libify-$(date +%F).dump"
docker compose exec -T db pg_dump -U libify -Fc libify > "$file.tmp"
mv "$file.tmp" "$file"
ls -1t backups/libify-*.dump | tail -n +8 | xargs -r rm --
echo "$(date -Is) backup ok: $file"
