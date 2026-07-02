#!/usr/bin/env bash
# Halı Platformu — günlük yedek (veritabanı + fotoğraflar).
# Her şey TEK sunucuda olduğu için yedeği SUNUCU DIŞINA göndermek ŞARTTIR
# (disk/donanım ölürse veri gitmesin). cron (flock: üst üste binme engeli):
#   30 4 * * * flock -n /run/hali-backup.lock bash /opt/hali/scripts/backup.sh >> /var/log/hali-backup.log 2>&1
# Başarısızlıkta /opt/hali/.env'deki SMTP ile kendine uyarı e-postası atar
# (aylarca sessizce başarısız olan yedek, hiç yedek olmamasından tehlikelidir).
set -Eeuo pipefail

APP_DIR=/opt/hali
COMPOSE="$APP_DIR/docker-compose.prod.yml"
BACKUP_DIR=/var/backups/hali
STAMP=$(date +%F_%H%M)
KEEP_DAYS=14
KEEP_MIN=8            # budama asla bu sayının altına düşürmez (yedekler günlerdir
                      # başarısızsa son sağlamları silme!)
MIN_FREE_KB=5242880   # 5 GB — paylaşımlı sunucuda diski doldurmak diğer siteleri de öldürür
# DİKKAT: volume adı compose proje önekiyle "hali_hali_uploads"tır ("hali_uploads" DEĞİL).
# Yanlış ad verilirse docker sessizce BOŞ bir volume yaratır ve boş arşiv alınır.
UPLOADS_VOLUME=hali_hali_uploads
ALPINE_IMG=alpine:3.20   # kurulumda pre-pull edildi; --pull=never ile Hub'a muhtaç değil

TMP_DB="$BACKUP_DIR/.db_$STAMP.sql.gz.part"
TMP_UP="$BACKUP_DIR/.uploads_$STAMP.tar.gz.part"

fail_alert() {
  echo "[$(date)] HATA: yedek başarısız (satır $1)" >&2
  rm -f "$TMP_DB" "$TMP_UP"
  # .env'deki Gmail SMTP ile uyarı e-postası (best-effort; atamazsa log yeter)
  local user pass host port
  user=$(grep -E '^SMTP_USER=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
  pass=$(grep -E '^SMTP_PASS=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
  host=$(grep -E '^SMTP_HOST=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
  port=$(grep -E '^SMTP_PORT=' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
  if [ -n "$user" ] && [ -n "$pass" ]; then
    printf 'From: %s\r\nTo: %s\r\nSubject: [hali] GECE YEDEGI BASARISIZ %s\r\n\r\nSunucuda gece yedegi basarisiz oldu. Bak: /var/log/hali-backup.log\r\n' \
      "$user" "$user" "$STAMP" | \
    curl -sS --ssl-reqd "smtp://${host:-smtp.gmail.com}:${port:-587}" \
      --mail-from "$user" --mail-rcpt "$user" \
      -u "$user:$pass" -T - --max-time 30 || true
  fi
}
trap 'fail_alert $LINENO' ERR

mkdir -p "$BACKUP_DIR"

# 0) Disk emniyeti — yer yoksa hiç başlama (ve e-postayla haber ver)
avail_kb=$(df --output=avail "$BACKUP_DIR" | tail -1 | tr -d ' ')
if [ "$avail_kb" -lt "$MIN_FREE_KB" ]; then
  echo "[$(date)] HATA: diskte yer yok (${avail_kb} KB kaldı)" >&2
  false
fi

# 1) Önce buda (başta: arşivleme patlarsa bile eski dolgu birikmesin) — ama
#    KEEP_MIN korumasıyla
db_count=$(find "$BACKUP_DIR" -maxdepth 1 -name 'db_*.sql.gz' | wc -l)
if [ "$db_count" -ge "$KEEP_MIN" ]; then
  find "$BACKUP_DIR" -maxdepth 1 -name 'db_*.sql.gz' -mtime +$KEEP_DAYS -delete
  find "$BACKUP_DIR" -maxdepth 1 -name 'uploads_*.tar.gz' -mtime +$KEEP_DAYS -delete
fi
rm -f "$BACKUP_DIR"/.*.part   # önceki koşudan yarım kalanlar

# 2) DB dökümü → geçici ad → doğrula (gzip bütünlüğü + pg_dump bitiş imzası +
#    boyut) → ancak o zaman gerçek ada al. Yarım dump asla yedek gibi görünmesin.
docker compose -f "$COMPOSE" exec -T db pg_dump -U hali hali | gzip > "$TMP_DB"
gunzip -t "$TMP_DB"
tail_lines=$(gunzip -c "$TMP_DB" | tail -n 20)
grep -q "PostgreSQL database dump complete" <<<"$tail_lines"
[ "$(stat -c%s "$TMP_DB")" -ge 1024 ]
mv "$TMP_DB" "$BACKUP_DIR/db_$STAMP.sql.gz"

# 3) Fotoğraflar → geçici ad → arşiv doğrulaması → gerçek ad
docker volume inspect "$UPLOADS_VOLUME" >/dev/null
docker run --rm --pull=never \
  -v "$UPLOADS_VOLUME":/data:ro \
  -v "$BACKUP_DIR":/backup \
  "$ALPINE_IMG" tar czf "/backup/$(basename "$TMP_UP")" -C /data .
tar tzf "$TMP_UP" >/dev/null
mv "$TMP_UP" "$BACKUP_DIR/uploads_$STAMP.tar.gz"

# 4) SUNUCU DIŞINA gönder — rclone kurup bir 'remote' tanımla (Cloudflare R2 /
#    Backblaze B2 / S3). Aşağıdaki satırı remote tanımladıktan sonra aç:
# rclone copy "$BACKUP_DIR" remote:hali-backups --max-age 25h

date > "$BACKUP_DIR/.last-ok"
echo "[$(date)] Yedek tamam: $STAMP"
