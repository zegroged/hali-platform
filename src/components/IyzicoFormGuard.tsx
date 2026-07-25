"use client";

import { useEffect, useState } from "react";

// iyzico kart formu, sunucudan gelen <script> etiketleriyle çizilir. Sayfaya
// client-side geçişle (Next <Link>) girilirse tarayıcı bu script'leri
// çalıştırmaz → kullanıcı BOŞ sayfa görür (2026-07-25 canlı hatası).
// Ana çözüm: abonelik sayfasındaki bağlantı tam sayfa yükleme yapar.
// Bu bileşen SON EMNİYET: 10 sn içinde form çizilmediyse sayfayı bir kez
// yeniden yükler (tek sefer — sonsuz döngü olmasın diye işaretlenir).
export function IyzicoFormGuard() {
  const [gorunur, setGorunur] = useState(false);

  useEffect(() => {
    const ANAHTAR = "iyzico-form-yeniden-yukleme";
    const zaman = setTimeout(() => {
      const kap = document.getElementById("iyzipay-checkout-form");
      const cizildi = Boolean(
        kap && (kap.childElementCount > 0 || document.querySelector("iframe")),
      );
      if (cizildi) return;
      if (sessionStorage.getItem(ANAHTAR)) {
        setGorunur(true); // yeniden yükleme de çare olmadı → kullanıcıya söyle
        return;
      }
      sessionStorage.setItem(ANAHTAR, "1");
      window.location.reload();
    }, 10000);
    return () => clearTimeout(zaman);
  }, []);

  if (!gorunur) return null;
  return (
    <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      Ödeme formu yüklenemedi. Sayfayı yenilemeyi ya da başka bir tarayıcı
      denemeyi öneririz; sorun sürerse bize yazın.
    </p>
  );
}
