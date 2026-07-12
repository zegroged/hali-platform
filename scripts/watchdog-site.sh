#!/usr/bin/env bash
# Site-down bekçisi — cron: */5 dakikada bir ana sayfayı dışarıdan yoklar.
# Üst üste 2 başarısız yoklamada (≈10 dk) BİR KEZ mail atar; site düzelince
# "düzeldi" maili atar ve durumu sıfırlar. Tekil dalgalanmada susar.
# Mailler sitenin markalı e-posta şablonuyla (UTF-8, HTML) gönderilir.
# Kurulum (root cron):
#   */5 * * * * flock -n /run/hali-site-watchdog.lock bash /opt/hali/scripts/watchdog-site.sh >> /var/log/hali-site-watchdog.log 2>&1
set -u

URL="https://enyakinhaliyikamaservisi.com/"
MAIL_TO="destek@enyakinhaliyikamaservisim.com"
ENVF="/opt/hali/.env"
FLAG="/run/hali-site-down.flag"      # down maili atıldı işareti
FAILCNT="/run/hali-site-failcount"   # ardışık başarısız yoklama sayısı

SMTP_USER=$(grep -E '^SMTP_USER=' "$ENVF" | cut -d= -f2- | tr -d '"')
SMTP_PASS=$(grep -E '^SMTP_PASS=' "$ENVF" | cut -d= -f2- | tr -d '"')

# Sitenin wrapEmail şablonunun (src/lib/email.ts) bash karşılığı — markalı HTML.
send_mail() { # $1=konu $2=içerik-html
  local html
  html="<!DOCTYPE html><html lang=\"tr\"><body style=\"margin:0;padding:0;background-color:#f1f5f9;\">
<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f1f5f9;padding:24px 0;\"><tr><td align=\"center\">
<table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"width:600px;max-width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;\">
<tr><td style=\"background-color:#0f766e;padding:20px 32px;\"><span style=\"font-size:18px;font-weight:bold;color:#ffffff;\">En Yakın Halı Yıkama</span></td></tr>
<tr><td style=\"padding:32px;color:#0f172a;font-size:15px;line-height:1.6;\">$2</td></tr>
<tr><td style=\"padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;line-height:1.6;\">
<a href=\"https://enyakinhaliyikamaservisi.com\" style=\"color:#0f766e;text-decoration:none;font-weight:bold;\">enyakinhaliyikamaservisi.com</a><br>
Bu uyarı, sunucudaki site bekçisi tarafından otomatik gönderildi.</td></tr>
</table></td></tr></table></body></html>"
  {
    echo "From: En Yakin Hali Yikama Bekcisi <$SMTP_USER>"
    echo "To: $MAIL_TO"
    echo "Subject: =?UTF-8?B?$(printf '%s' "$1" | base64 -w0)?="
    echo "MIME-Version: 1.0"
    echo "Content-Type: text/html; charset=UTF-8"
    echo "Content-Transfer-Encoding: base64"
    echo ""
    printf '%s' "$html" | base64
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
    send_mail "✅ Site düzeldi — enyakinhaliyikamaservisi.com" \
"<p style=\"margin:0 0 12px;\"><strong>Site tekrar yayında.</strong></p>
<p style=\"margin:0 0 12px;\">Ana sayfa $(date '+%d.%m.%Y %H:%M') itibarıyla yeniden 200 dönüyor. Yapman gereken bir şey yok.</p>"
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

send_mail "🔴 Site YANIT VERMİYOR — enyakinhaliyikamaservisi.com" \
"<p style=\"margin:0 0 12px;\"><strong>Ana sayfa üst üste 2 yoklamada açılmadı</strong> (son HTTP kodu: $code, $(date '+%d.%m.%Y %H:%M')).</p>
<p style=\"margin:0 0 12px;\">Bu genellikle uygulama konteynerinin durması veya sunucu sorunudur. Claude'a &quot;site down maili geldi, bak&quot; yazman yeterli — ya da elle kontrol:</p>
<pre style=\"margin:0 0 12px;background:#f8fafc;padding:12px;border-radius:8px;font-size:13px;\">ssh root@[SUNUCU]
docker ps | grep hali
docker logs hali-app-1 --tail 50</pre>
<p style=\"margin:0;color:#64748b;font-size:13px;\">Site düzeldiğinde bekçi otomatik olarak &quot;düzeldi&quot; maili gönderir; bu uyarı kesinti başına bir kez atılır.</p>"
touch "$FLAG"
echo "$(date '+%F %T') DOWN maili gonderildi + flag"
