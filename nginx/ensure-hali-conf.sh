#!/usr/bin/env bash
# hali.conf EPHEMERAL sorununa bekçi: kafe-nginx-1 yeniden yaratılırsa (recreate)
# docker cp ile konmuş hali.conf ve hali_default ağ bağlantısı kaybolur → site kesilir.
# Bu betik cron'dan 5 dk'da bir çalışır, eksik olanı geri ekler. Sorun yoksa SESSİZDİR.
#   */5 * * * * flock -n /run/hali-nginx-watchdog.lock bash /opt/hali/nginx/ensure-hali-conf.sh >> /var/log/hali-nginx-watchdog.log 2>&1
# Notlar:
# - Sertifikalar (/etc/nginx/certs) ve default.conf host bind-mount'tur, recreate'te
#   kaybolmaz; yalnız hali.conf + ağ bağlantısı ephemeral'dır.
# - hali.conf değişken proxy_pass + resolver 127.0.0.11 kullanır: hali-app-1 yeniden
#   yaratılıp IP değişse bile nginx adı istek anında çözer, reload GEREKMEZ.
set -Eeuo pipefail

CONF_SRC=/opt/hali/nginx/hali.conf
NGINX=kafe-nginx-1

dk() { timeout 60 docker "$@"; }   # asılı docker daemon'da süreç biriktirme

# nginx konteyneri (henüz) yoksa yapacak bir şey yok — kafe tarafına DOKUNMAYIZ
names=$(dk ps --format '{{.Names}}')
grep -qx "$NGINX" <<<"$names" || exit 0

# hali ağı yoksa (hali stack kapalı / deploy anı) sessizce çık — hata döngüsü kurma
dk network inspect hali_default >/dev/null 2>&1 || exit 0

# 1) Ağ: kafe-nginx hali_default'a bağlı değilse bağla
members=$(dk network inspect hali_default --format '{{range .Containers}}{{.Name}} {{end}}')
if ! grep -qw "$NGINX" <<<"$members"; then
  echo "[$(date)] $NGINX hali_default agina bagli degildi — baglaniyor"
  dk network connect hali_default "$NGINX"
fi

# 2) Conf: yoksa geri ekle — ama önce TABAN testi: paylaşılan nginx hali'den
#    BAĞIMSIZ olarak zaten bozuksa hiçbir şeye dokunma (suç hali.conf'a atılmasın,
#    kafe sitelerini riske atacak reload denenmesin)
if ! dk exec "$NGINX" test -f /etc/nginx/conf.d/hali.conf; then
  if ! dk exec "$NGINX" nginx -t >/dev/null 2>&1; then
    echo "[$(date)] HATA: paylasilan nginx conf'u hali'den bagimsiz bozuk — dokunulmadi, elle bak!" >&2
    exit 1
  fi
  echo "[$(date)] hali.conf yoktu — geri ekleniyor"
  dk cp "$CONF_SRC" "$NGINX":/etc/nginx/conf.d/hali.conf
  if dk exec "$NGINX" nginx -t; then
    dk exec "$NGINX" nginx -s reload
    echo "[$(date)] hali.conf geri eklendi + reload OK"
  else
    # bozuk conf ile dijitalkafe/to-p1/fayans'ı riske atma — geri çek, hatayı logla
    dk exec "$NGINX" rm -f /etc/nginx/conf.d/hali.conf
    echo "[$(date)] HATA: hali.conf nginx -t'yi bozdu — geri cekildi, elle bak!" >&2
    exit 1
  fi
fi
