"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// MESAJ SAYFASI KENDİNİ YENİLESİN (2026-08-07 akşam).
//
// 🔴 SORUN (işletme sahibi, canlıda): *"müşteriye kesin fiyat mesajı gitti,
// yanıt penceresi açılmadı. Bana yazdı da... tek seferlik bir konuşma mı
// olabiliyor?"*
//
// TEŞHİS: pencere kuralı DOĞRU çalışıyordu — müşteri yazınca 24 saatlik yanıt
// penceresi açılır. Ama bu sayfa bir sunucu bileşeni ve **kendini hiç
// yenilemiyordu**: halıcı sayfayı açık bırakıp beklerken müşterinin mesajı
// geliyor, ekranda hâlâ "Yanıt penceresi kapalı" yazıyordu. Yani kural değil,
// EKRAN yanlış söylüyordu. Panelin zili 20 sn'de bir yokluyor ama o yalnız
// bildirim rozetini günceller, sayfayı tazelemez.
//
// ÇÖZÜM: sayfa açıkken 15 sn'de bir `router.refresh()`. Sunucu bileşeni
// yeniden çalışır; yeni mesaj, açılan yanıt penceresi ve okundu işareti
// kendiliğinden görünür. Girilen metin kaybolmaz (refresh DOM'u korur).
//
// ⚠️ Sekme arkadayken yenilemiyoruz: telefonun pilini ve sunucuyu boşuna
// yormasın (uygulama WebView'inde panel arka planda da açık kalıyor).
const ARALIK_MS = 15_000;

export default function MesajTazele() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, ARALIK_MS);
    // Sekmeye/uygulamaya geri dönüldüğünde beklemeden tazele.
    const geri = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", geri);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", geri);
    };
  }, [router]);
  return null;
}
