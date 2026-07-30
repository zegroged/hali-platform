#!/bin/sh
# WhatsApp sablon onay nobetcisi. SUNUCUDAKI YERI: /opt/hali-probe/wa-sablon.sh
# (root cron her 10 dk calistirir). Bu dosya deponun kopyasidir; sunucuya
# kopyalanip cron'a birakilir.
#
# 2026-07-30 (v4): IKI GRUP izlenir.
#  GRUP-ESKI : Turkce metni duzeltilen 6 sablon (butonsuz).
#  GRUP-LINK : URL butonlu 5 yeni sablon (kullanici karari: her bildirimde
#              tiklanabilir takip linki). Kod sendTemplateLinkli ile ONCE
#              linkliyi dener, onaysizsa eskiye duser - yani LINK grubu
#              onaylandigi an linkli mesajlar EK DEPLOY OLMADAN acilir.
#  Her grup icin ayri bayrak + ayri mail. REJECTED gorulurse de mail atilir
#  (duzeltilmesi gerekir; eski akis calismaya devam eder, panik yok).
LOG=/var/log/hali-wa-sablon.log
FLAG_ESKI=/opt/hali-probe/wa-onaylandi-3-alti-sablon.flag
FLAG_LINK=/opt/hali-probe/wa-onaylandi-4-linkli.flag
FLAG_RED=/opt/hali-probe/wa-red-uyarisi-4.flag
GRUP_ESKI="siparis_alindi fiyat_onayi_bekleniyor siparis_hazir siparis_yolda siparis_teslim_edildi siparis_iptal"
GRUP_LINK="siparis_alindi_link fiyat_onayi_link siparis_yolda_link siparis_teslim_link siparis_iptal_link"
TOKEN=$(grep "^WHATSAPP_TOKEN=" /opt/hali/.env | cut -d= -f2-)
OUT=$(curl -s -m 25 "https://graph.facebook.com/v21.0/1355565982729678/message_templates?fields=name,status&limit=100" -H "Authorization: Bearer $TOKEN")

durum() { # $1=sablon adi -> APPROVED/PENDING/REJECTED/YOK
  D=$(echo "$OUT" | tr "{" "\n" | grep "\"$1\"" | grep -o "APPROVED\|PENDING\|REJECTED" | head -1)
  [ -z "$D" ] && D=YOK
  echo "$D"
}

posta() { # $1=konu, $2=govde
  SMTP_USER=$(grep "^SMTP_USER=" /opt/hali/.env | cut -d= -f2- | tr -d "\"")
  SMTP_PASS=$(grep "^SMTP_PASS=" /opt/hali/.env | cut -d= -f2- | tr -d "\"")
  { echo "From: En Yakin Hali Yikama <$SMTP_USER>"; echo "To: [EPOSTA]";
    echo "Subject: $1"; echo ""; printf "%s\n" "$2"; } > /tmp/wa-mail4.txt
  curl -s --url smtp://smtp.gmail.com:587 --ssl-reqd --mail-from "$SMTP_USER" \
    --mail-rcpt "[EPOSTA]" --upload-file /tmp/wa-mail4.txt \
    --user "$SMTP_USER:$SMTP_PASS" > /dev/null 2>&1
}

SATIR=""; ESKI_OK=1; LINK_OK=1; REDLER=""
for S in $GRUP_ESKI; do
  D=$(durum "$S"); SATIR="$SATIR $S=$D"
  [ "$D" = "APPROVED" ] || ESKI_OK=0
  [ "$D" = "REJECTED" ] && REDLER="$REDLER $S"
done
for S in $GRUP_LINK; do
  D=$(durum "$S"); SATIR="$SATIR $S=$D"
  [ "$D" = "APPROVED" ] || LINK_OK=0
  [ "$D" = "REJECTED" ] && REDLER="$REDLER $S"
done
echo "$(date "+%F %T")$SATIR" >> $LOG

if [ -n "$REDLER" ] && [ ! -f "$FLAG_RED" ]; then
  posta "WhatsApp: sablon REDDEDILDI:$REDLER" \
"Su sablonlar Meta tarafindan reddedildi:$REDLER

Eski onayli sablonlar calismaya devam ediyor, musteri bildirimi KESILMEDI.
Ama linkli mesaj / duzeltilmis Turkce o sablonda devreye giremez.
Yapilacak: ret sebebini API'den oku, metni duzelt, YENI ADLA tekrar gonder
(ayni ad hemen yeniden kullanilamaz)."
  touch $FLAG_RED
fi

if [ "$ESKI_OK" = "1" ] && [ ! -f "$FLAG_ESKI" ]; then
  posta "WhatsApp: 6 duzeltilmis sablonun HEPSI ONAYLANDI" \
"Turkce metni duzeltilen alti sablonun tamami APPROVED.
Kod tarafinda is YOK; sistem zaten acik, mesajlar duzgun Turkce gidiyor."
  touch $FLAG_ESKI
fi

if [ "$LINK_OK" = "1" ] && [ ! -f "$FLAG_LINK" ]; then
  posta "WhatsApp: LINKLI 5 sablonun HEPSI ONAYLANDI - linkler CANLI" \
"URL butonlu bes sablon (siparis_alindi_link, fiyat_onayi_link,
siparis_yolda_link, siparis_teslim_link, siparis_iptal_link) APPROVED.

Kod tarafinda is YOK: sendTemplateLinkli ilk denemede linkliyi kullanir.
Su andan itibaren musteriye giden her bildirimde 'takip et / fiyati onayla'
butonu var. Kendi ikinci telefonunuza test siparisi verip butonu dogrulayin."
  touch $FLAG_LINK
fi
