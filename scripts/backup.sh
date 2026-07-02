#!/usr/bin/env bash
# Halı Platformu — günlük yedek (veritabanı + fotoğraflar).
# Her şey TEK sunucuda olduğu için yedeği SUNUCU DIŞINA göndermek ŞARTTIR
# (disk/donanım ölürse veri gitmesin). cron ile günlük çalıştır.
set -euo pipefail

APP_DIR=/opt/hali                      # uygulamanın bulunduğu dizin
COMPOSE="$APP_DIR/docker-compose.prod.yml"
BACKUP_DIR=/var/backups/hali
STAMP=$(date +%F_%H%M)
KEEP_DAYS=14

mkdir -p "$BACKUP_DIR"

# 1) Veritabanı dökümü (compose içindeki db servisinden)
docker compose -f "$COMPOSE" exec -T db \
  pg_dump -U hali hali | gzip > "$BACKUP_DIR/db_$STAMP.sql.gz"

# 2) Fotoğraflar (yerel disk volume → tar)
docker run --rm \
  -v hali_uploads:/data:ro \
  -v "$BACKUP_DIR":/backup \
  alpine tar czf "/backup/uploads_$STAMP.tar.gz" -C /data . || true

# 3) Eski yerel yedekleri temizle
find "$BACKUP_DIR" -name '*.gz' -mtime +$KEEP_DAYS -delete

# 4) SUNUCU DIŞINA gönder — rclone kurup bir 'remote' tanımla (Cloudflare R2 /
#    Backblaze B2 / S3). Aşağıdaki satırı remote tanımladıktan sonra aç:
# rclone copy "$BACKUP_DIR" remote:hali-backups --max-age 25h

echo "[$(date)] Yedek tamam: $STAMP"
