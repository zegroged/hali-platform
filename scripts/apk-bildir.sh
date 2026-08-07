#!/bin/bash
# APK HAZIR OLUNCA MAİL AT (2026-08-06)
#
# Kullanıcı bilgisayar başında olmayacak ve şunu istedi: "linki kontrol ettikten
# sonra at, eksik yanlışlık hata olmasın indirebileyim."
#
# Bu yüzden betik linki GÖNDERMEDEN ÖNCE SINAR:
#   · HTTP durumu 200 mü
#   · dosya boyutu makul mü (>20 MB — APK ~60 MB, 0 baytlık/HTML hata sayfası olmasın)
# Sınama geçmezse yine mail atar ama "link bozuk" diye AÇIKÇA söyler; sessiz
# kalıp kullanıcıyı boşuna bekletmez.
#
# Oturumdan bağımsız çalışır (nohup): bilgisayar kapansa da sunucuda döner.

set -u
BUILD_ID="${1:?build id gerekli}"
ALICI="${2:-[EPOSTA]}"
TOKEN="${EXPO_TOKEN:?EXPO_TOKEN gerekli}"

ARALIK=60          # saniye
MAX_TUR=180        # 180 x 60sn = 3 saat tavan
LOG=/var/log/hali-apk-bildir.log

log() { echo "[$(date '+%F %T')] $*" >> "$LOG"; }

# .env'den SMTP bilgileri (sunucuda kalır, hiçbir yere yazılmaz)
set -a; . /opt/hali/.env; set +a

mail_at() {
  local konu="$1" govde="$2" dosya=/tmp/apk-mail-$$.txt
  printf 'From: %s\nTo: %s\nSubject: =?UTF-8?B?%s?=\nContent-Type: text/plain; charset=UTF-8\n\n%s\n' \
    "$SMTP_USER" "$ALICI" "$(printf '%s' "$konu" | base64 -w0)" "$govde" > "$dosya"
  if curl -s --url "smtp://$SMTP_HOST:$SMTP_PORT" --ssl-reqd \
      --user "$SMTP_USER:$SMTP_PASS" \
      --mail-from "$SMTP_USER" --mail-rcpt "$ALICI" \
      --upload-file "$dosya"; then
    log "mail gonderildi: $konu"
  else
    log "MAIL GONDERILEMEDI: $konu"
  fi
  rm -f "$dosya"
}

log "izleme basladi — build $BUILD_ID"

for ((i=1; i<=MAX_TUR; i++)); do
  YANIT=$(curl -s -X POST https://api.expo.dev/graphql \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"query\":\"query(\$id: ID!){ builds { byId(buildId:\$id){ status appVersion appBuildVersion artifacts { buildUrl applicationArchiveUrl } } } }\",\"variables\":{\"id\":\"$BUILD_ID\"}}")

  DURUM=$(printf '%s' "$YANIT" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  [ -z "$DURUM" ] && { log "durum okunamadi, tekrar denenecek"; sleep "$ARALIK"; continue; }

  case "$DURUM" in
    FINISHED)
      URL=$(printf '%s' "$YANIT" | grep -o '"buildUrl":"[^"]*"' | head -1 | cut -d'"' -f4)
      [ -z "$URL" ] && URL=$(printf '%s' "$YANIT" | grep -o '"applicationArchiveUrl":"[^"]*"' | head -1 | cut -d'"' -f4)
      SURUM=$(printf '%s' "$YANIT" | grep -o '"appVersion":"[^"]*"' | head -1 | cut -d'"' -f4)
      VC=$(printf '%s' "$YANIT" | grep -o '"appBuildVersion":"[^"]*"' | head -1 | cut -d'"' -f4)
      log "build bitti, link sinaniyor: $URL"

      # --- LİNK SINAMASI (kullanıcının istediği kontrol) ---
      KOD=$(curl -s -o /dev/null -L -w '%{http_code}' --max-time 60 -I "$URL")
      BOYUT=$(curl -s -o /dev/null -L -w '%{size_download}' --max-time 120 -r 0-1048575 "$URL")
      TOPLAM=$(curl -sIL --max-time 60 "$URL" | grep -i '^content-length:' | tail -1 | tr -dc '0-9')
      [ -z "$TOPLAM" ] && TOPLAM=0
      MB=$((TOPLAM / 1024 / 1024))
      log "sinama: HTTP=$KOD boyut=${MB}MB ilk-parca=${BOYUT}B"

      if [ "$KOD" = "200" ] && [ "$TOPLAM" -gt 20971520 ]; then
        mail_at "Hali Sofor $SURUM (vc$VC) APK hazir — link dogrulandi" \
"APK derlendi ve indirme linki SINANDI.

  Surum : $SURUM (versionCode $VC)
  Boyut : ${MB} MB
  Kontrol: HTTP $KOD, dosya erisilebilir  [TAMAM]

INDIRME LINKI (telefondan ac):
$URL

Kurulum: linke telefondan tikla, indir, ac. Android 'bilinmeyen kaynak'
uyarisi verirse bu tarayiciya izin ver.

TEST EDILECEKLER (onem sirasiyla):
1) FOTOGRAF (en onemlisi — tek acik is bu) — 'Haliyi Aldim' derken hata
   olursa artik SEBEBINI yaziyor. Ekranda cikan yaziyi AYNEN not al ya da
   ekran goruntusu al. Dort farkli mesajdan hangisi ciktigi, sorunun
   nerede oldugunu tek basina soyluyor.
2) KONUM — mesaiyi ac, telefonu masaya birak, 15-20 dk bekle. Panel >
   Canli Takip'te harita HIC yol cizmemeli ('duruyor' demeli). Sonra
   araca bin: yol normal cizilmeli.
3) Push — uygulamayi TAMAMEN kapat, baska telefondan siparis olustur
4) Kac hali aldin? — alim ekranindaki alan
5) Calisan paneli — panelden hesap ac, o hesapla gir; kasa/profil gorunmemeli
6) Kasma — sayfa gecislerinde iskelet cikmali

Not: bu mail otomatik gonderildi."
      else
        mail_at "Hali Sofor $SURUM (vc$VC) build bitti AMA link dogrulanamadi" \
"Build FINISHED durumunda ama indirme linki sinamayi GECEMEDI.

  HTTP durumu : $KOD
  Bildirilen boyut: ${MB} MB
  Link: $URL

Yine de deneyebilirsin; acilmazsa Claude'a haber ver, yeniden alinir.

Not: bu mail otomatik gonderildi."
      fi
      log "bitti"; exit 0
      ;;
    ERRORED|CANCELED)
      mail_at "Hali Sofor build BASARISIZ ($DURUM)" \
"Build tamamlanamadi. Durum: $DURUM

Expo panelinden loglara bakilabilir:
https://expo.dev/accounts/enyakinhaliyikamaservisi/projects/hali-driver/builds/$BUILD_ID

Not: bu mail otomatik gonderildi."
      log "build basarisiz: $DURUM"; exit 1
      ;;
    *)
      log "durum=$DURUM (tur $i/$MAX_TUR)"
      ;;
  esac
  sleep "$ARALIK"
done

mail_at "Hali Sofor build — 3 saattir sonuc yok" \
"Izleme 3 saat sonra durduruldu, build hala bitmedi.
https://expo.dev/accounts/enyakinhaliyikamaservisi/projects/hali-driver/builds/$BUILD_ID"
log "zaman asimi"
