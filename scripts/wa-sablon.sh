#!/bin/sh
# WhatsApp sablon onay nobetcisi. SUNUCUDAKI YERI: /opt/hali-probe/wa-sablon.sh
# (root cron her 10 dk calistirir). Bu dosya deponun kopyasidir; sunucuya
# kopyalanip cron'a birakilir.
#
# 2026-07-30: ALTI sablonun METNI duzeltildi (Turkce harfler "?" olmustu) ve
# hepsi yeniden PENDING'e dustu. Onceki surum yalnizca siparis_teslim_edildi +
# siparis_iptal izliyordu; artik ALTISI birden izlenir. Mail YALNIZ hepsi
# APPROVED olunca gider (bir tanesi bile PENDING/REJECTED ise beklenir), sonra
# bayrak dosyasi konur ve nobetci susar. Bayrak adi surumle degisir - eski
# bayrak (wa-onaylandi-2.flag) duruyor diye yeni tur atlanmasin.
#
# Kod tarafinda ek is YOK: alti sablon da bagli (lib/whatsapp.ts + orderNotify),
# onay gelince kendiliginden calisir. TEK ELLE ADIM: .env'e
# WHATSAPP_PHONE_ID=1194238993780059 ekleyip app'i yeniden baslatmak.
LOG=/var/log/hali-wa-sablon.log
FLAG=/opt/hali-probe/wa-onaylandi-3-alti-sablon.flag
IZLENEN="siparis_alindi fiyat_onayi_bekleniyor siparis_hazir siparis_yolda siparis_teslim_edildi siparis_iptal"
TOKEN=$(grep "^WHATSAPP_TOKEN=" /opt/hali/.env | cut -d= -f2-)
OUT=$(curl -s -m 25 "https://graph.facebook.com/v21.0/1355565982729678/message_templates?fields=name,status&limit=100" -H "Authorization: Bearer $TOKEN")
SATIR=""
HEPSI_ONAYLI=1
for S in $IZLENEN; do
  # Sablon adlari birbirinin ONEKI DEGIL, ama "siparis_hazir" gibi adlar baska
  # alanlarin icinde de gecebilir; tirnakli tam ad araniyor.
  D=$(echo "$OUT" | tr "{" "\n" | grep "\"$S\"" | grep -o "APPROVED\|PENDING\|REJECTED" | head -1)
  [ -z "$D" ] && D=YOK
  SATIR="$SATIR $S=$D"
  [ "$D" = "APPROVED" ] || HEPSI_ONAYLI=0
done
echo "$(date "+%F %T")$SATIR" >> $LOG
[ -f "$FLAG" ] && exit 0
[ "$HEPSI_ONAYLI" = "1" ] || exit 0
SMTP_USER=$(grep "^SMTP_USER=" /opt/hali/.env | cut -d= -f2- | tr -d "\"")
SMTP_PASS=$(grep "^SMTP_PASS=" /opt/hali/.env | cut -d= -f2- | tr -d "\"")
{ echo "From: En Yakin Hali Yikama <$SMTP_USER>"; echo "To: [EPOSTA]";
  echo "Subject: WhatsApp: ALTI sablonun HEPSI ONAYLANDI"; echo "";
  echo "Metni duzeltilen alti sablonun tamami Metada APPROVED oldu:"
  echo "siparis_alindi, fiyat_onayi_bekleniyor, siparis_hazir, siparis_yolda,"
  echo "siparis_teslim_edildi, siparis_iptal."
  echo ""
  echo "Kod tarafinda yapilacak is YOK - alti sablon da bagli."
  echo "TEK ADIM: /opt/hali/.env dosyasina WHATSAPP_PHONE_ID=1194238993780059"
  echo "ekle ve 'docker compose up -d --force-recreate app' calistir; ardindan"
  echo "kendi numarana test siparisi ver."; } > /tmp/wa-mail3.txt
curl -s --url smtp://smtp.gmail.com:587 --ssl-reqd --mail-from "$SMTP_USER" --mail-rcpt "[EPOSTA]" --upload-file /tmp/wa-mail3.txt --user "$SMTP_USER:$SMTP_PASS" > /dev/null 2>&1
touch $FLAG
