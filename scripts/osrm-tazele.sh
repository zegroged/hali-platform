#!/bin/bash
# OSRM YOL VERİSİ TAZELEME — ayda bir (root cron).
#
# NEDEN: indirilen OSM verisi DONMUŞ bir kopyadır. Yeni açılan sokak, kapanan
# yol, değişen tek yön... hiçbiri kendiliğinden gelmez. İşletme sahibi sordu:
# "Türkiye yol verisi güncel mi?" — cevabı bu betik veriyor.
#
# GÜVENLİ TAKAS: yeni veri AYRI klasöre kurulur, ancak duman testini geçerse
# servis ona çevrilir. Derleme yarıda kalırsa ESKİ veri çalışmaya devam eder.
set -u
KOK=/opt/osrm
YENI=$KOK/yeni
LOG=/var/log/osrm-tazele.log
IMG=ghcr.io/project-osrm/osrm-backend:latest
NICE="nice -n 15 ionice -c3"
log() { echo "[$(date '+%F %T')] $*" >> "$LOG"; }
mail_at() {
  set -a; . /opt/hali/.env; set +a
  printf 'From: %s\nTo: [EPOSTA]\nSubject: =?UTF-8?B?%s?=\nContent-Type: text/plain; charset=UTF-8\n\n%s\n' \
    "$SMTP_USER" "$(printf '%s' "$1" | base64 -w0)" "$2" > /tmp/osrm-mail.txt
  curl -s --url "smtp://$SMTP_HOST:$SMTP_PORT" --ssl-reqd --user "$SMTP_USER:$SMTP_PASS" \
    --mail-from "$SMTP_USER" --mail-rcpt "[EPOSTA]" --upload-file /tmp/osrm-mail.txt >/dev/null
  rm -f /tmp/osrm-mail.txt
}

log "=== tazeleme basladi ==="
rm -rf "$YENI"; mkdir -p "$YENI"
if ! curl -sL --retry 3 --max-time 3600 -o "$YENI/turkey-latest.osm.pbf" \
     https://download.geofabrik.de/europe/turkey-latest.osm.pbf; then
  log "INDIRME BASARISIZ — eski veri kaliyor"; mail_at "OSRM tazeleme: indirme basarisiz" "Yol verisi indirilemedi, ESKI veri calismaya devam ediyor."; exit 1
fi
BOYUT=$(stat -c %s "$YENI/turkey-latest.osm.pbf")
[ "$BOYUT" -lt 100000000 ] && { log "dosya cok kucuk ($BOYUT) — iptal"; exit 1; }

for adim in "osrm-extract -p /opt/car.lua -t 4 /data/yeni/turkey-latest.osm.pbf" \
            "osrm-partition -t 4 /data/yeni/turkey-latest.osrm" \
            "osrm-customize -t 4 /data/yeni/turkey-latest.osrm"; do
  log "adim: $adim"
  if ! $NICE docker run --rm -v "$KOK:/data" "$IMG" $adim >>"$LOG" 2>&1; then
    log "ADIM BASARISIZ — eski veri kaliyor"; mail_at "OSRM tazeleme: derleme basarisiz" "Adim: $adim. ESKI veri calismaya devam ediyor."; exit 1
  fi
done

# Duman testi: yeni veriyle gecici servis
docker rm -f osrm-test >/dev/null 2>&1 || true
docker run -d --name osrm-test -p 127.0.0.1:5001:5000 -v "$KOK:/data" "$IMG" \
  osrm-routed --algorithm mld --max-matching-size 1000 /data/yeni/turkey-latest.osrm >/dev/null
sleep 10
SONUC=$(curl -s "http://127.0.0.1:5001/match/v1/driving/32.4842,37.9516;32.4855,37.9525?geometries=geojson&radiuses=25;25" | head -c 40)
docker rm -f osrm-test >/dev/null 2>&1
case "$SONUC" in
  *'"code":"Ok"'*) log "duman testi GECTI" ;;
  *) log "DUMAN TESTI GECMEDI ($SONUC) — eski veri kaliyor"; mail_at "OSRM tazeleme: duman testi gecmedi" "Yeni veri sinamayi gecemedi, ESKI veri calisiyor."; exit 1 ;;
esac

# TAKAS
mv "$KOK"/turkey-latest.osrm* "$KOK/eski_" 2>/dev/null || true
rm -f "$KOK"/eski_* 2>/dev/null || true
mv "$YENI"/turkey-latest.osrm* "$KOK/" 2>/dev/null
mv -f "$YENI/turkey-latest.osm.pbf" "$KOK/turkey-latest.osm.pbf"
rm -rf "$YENI"
docker rm -f osrm >/dev/null 2>&1 || true
docker run -d --name osrm --restart unless-stopped -p 127.0.0.1:5000:5000 \
  -v "$KOK:/data" "$IMG" osrm-routed --algorithm mld --max-matching-size 1000 \
  /data/turkey-latest.osrm >/dev/null
docker network connect hali_default osrm 2>/dev/null || true
sleep 8
YENI_SONUC=$(curl -s "http://127.0.0.1:5000/match/v1/driving/32.4842,37.9516;32.4855,37.9525?geometries=geojson&radiuses=25;25" | head -c 40)
log "takas sonrasi: $YENI_SONUC"
mail_at "OSRM yol verisi tazelendi" "Turkiye yol verisi guncellendi ve sinandi. Yeni veri boyutu: $((BOYUT/1024/1024)) MB."
log "=== bitti ==="
