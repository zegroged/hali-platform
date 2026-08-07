"use client";

import { useEffect } from "react";

// KAYAN OTURUM — PANEL AÇILDIKÇA ÇEREZİ TAZELE (2026-08-07 akşam).
//
// SORUN (işletme sahibi): *"işletme sahipleri kendi paneline girerken sürekli
// kullanıcı adı şifre girmek zorunda."*
//
// İki ayrı sebep vardı, ikisi de kapatıldı:
//  1. ÇEREZ `sameSite: strict`'ti → e-posta/WhatsApp/Google gibi DIŞ bir
//     bağlantıdan panele girildiğinde tarayıcı çerezi hiç göndermiyordu ve
//     panel "oturum yok" diyordu. `lax` yapıldı (bkz. lib/auth.ts).
//  2. Çerez 30 günlüktü ama YENİLENMİYORDU → her ay bir kez giriş isteniyordu.
//     Bu bileşen paneli her açılışta (günde en fazla bir kez) `/api/auth/yenile`
//     çağırıp süreyi 30 güne döndürüyor. Aktif kullanan bir daha hiç girmez.
//
// Günde bir kereye sınırlama `localStorage` ile: her sayfa geçişinde istek
// atmanın anlamı yok (panel sunucu bileşeni, sayfa değiştikçe bu bileşen
// yeniden kurulur).
const ANAHTAR = "hali_oturum_tazeleme";
const ARALIK_MS = 12 * 60 * 60 * 1000; // 12 saat

export default function OturumTazele() {
  useEffect(() => {
    try {
      const son = Number(localStorage.getItem(ANAHTAR) ?? 0);
      if (Date.now() - son < ARALIK_MS) return;
      // Önce damgayı yaz: istek başarısız olsa bile döngüye girmesin.
      localStorage.setItem(ANAHTAR, String(Date.now()));
    } catch {
      // localStorage kapalıysa (gizli sekme) yine de bir kez dene.
    }
    void fetch("/api/auth/yenile", { method: "POST" }).catch(() => {});
  }, []);
  return null;
}
