#!/usr/bin/env bash
# Site-down bekçisi — cron: */5 dakikada bir ana sayfayı dışarıdan yoklar.
# Üst üste 2 başarısız yoklamada (≈10 dk) BİR KEZ mail atar; site düzelince
# "düzeldi" maili atar ve durumu sıfırlar. Tekil dalgalanmada susar.
# Kurulum (root cron):
#   */5 * * * * flock -n /run/hali-site-watchdog.lock bash /opt/hali/scripts/watchdog-site.sh >> /var/log/hali-site-watchdog.log 2>&1
set -u

URL="https://enyakinhaliyikamaservisi.com/"
MAIL_TO="[EPOSTA]"
ENVF="/opt/hali/.env"
FLAG="/run/hali-site-down.flag"      # down maili atıldı işareti
FAILCNT="/run/hali-site-failcount"   # ardışık başarısız yoklama sayısı

SMTP_USER=$(grep -E '^SMTP_USER=' "$ENVF" | cut -d= -f2- | tr -d '"')
SMTP_PASS=$(grep -E '^SMTP_PASS=' "$ENVF" | cut -d= -f2- | tr -d '"')

send_mail() { # $1=konu $2=govde
  local subj_b64
  subj_b64=$(printf '%s' "$1" | base64)
  {
    echo "From: $SMTP_USER"
    echo "To: $MAIL_TO"
    echo "Subject: =?UTF-8?B?${subj_b64}?="
    echo "Content-Type: text/plain; charset=UTF-8"
    echo ""
    echo "$2"
  } > /tmp/hali-watchdog-mail.txt
  curl -s --url smtp://smtp.gmail.com:587 --ssl-reqd \
    --mail-from "$SMTP_USER" --mail-rcpt "$MAIL_TO" \
    --user "$SMTP_USER:$SMTP_PASS" -T /tmp/hali-watchdog-mail.txt
  rm -f /tmp/hali-watchdog-mail.txt
}

code=$(curl -s -o /dev/null -m 20 -w '%{http_code}' "$URL" 2>/dev/null || echo 000)

if [ "$code" = "200" ]; then
  rm -f "$FAILCNT"
  if [ -f "$FLAG" ]; then
    rm -f "$FLAG"
    send_mail "SITE DUZELDI - enyakinhaliyikamaservisi.com" \
"Site tekrar 200 donuyor ($(date '+%d.%m.%Y %H:%M')). Ek islem gerekmez."
    echo "$(date '+%F %T') DUZELDI maili gonderildi"
  fi
  exit 0
fi

n=$(( $(cat "$FAILCNT" 2>/dev/null || echo 0) + 1 ))
echo "$n" > "$FAILCNT"
echo "$(date '+%F %T') YOKLAMA BASARISIZ (HTTP $code, ardisik $n)"

# Tek dalgalanmada mail atma; zaten haber verildiyse tekrarlama.
[ "$n" -lt 2 ] && exit 0
[ -f "$FLAG" ] && exit 0

send_mail "SITE DOWN - enyakinhaliyikamaservisi.com (HTTP $code)" \
"Ana sayfa ust uste 2 yoklamada 200 donmedi (son kod: $code, $(date '+%d.%m.%Y %H:%M')).

Kontrol icin:
  ssh root@[SUNUCU]
  docker ps | grep hali
  docker logs hali-app-1 --tail 50
  docker compose -f /opt/hali/docker-compose.prod.yml up -d app

Site duzelince bu bekci otomatik 'duzeldi' maili atar."
touch "$FLAG"
echo "$(date '+%F %T') DOWN maili gonderildi + flag"
