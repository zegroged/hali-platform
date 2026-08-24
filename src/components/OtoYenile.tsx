"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * 🔴 SUNUCU BİLEŞENİNİ PERİYODİK TAZELE (2026-08-11).
 *
 * SORUN (ikiz denetimi): web şoför sayfası `force-dynamic` ama HİÇ kendini
 * yenilemiyordu. İşletme panelden iş atadığında, kesin fiyatı girdiğinde ya da
 * siparişi iptal ettiğinde şoförün ekranı olduğu gibi kalıyordu. Üstelik boş
 * ekrandaki metin *"Halıcın sana yeni bir iş atadığında burada görünecek"*
 * diyor — yani ekran, yapmadığı şeyi vaat ediyordu. Elle yenileme düğmesi de
 * yoktu.
 *
 * Mobil ikizi bunu 45 saniyede bir yapıyor (driver-app/src/Orders.tsx:163) +
 * aşağı çekince yenileme.
 *
 * ⚠️ ÜÇ KORUMA — bu depoda tazelemenin zarar verdiği vakalar yaşandı:
 *  1. **Form gönderilirken tazeleme YOK.** `PendingButton` gönderim boyunca
 *     `aria-busy="true"` basıyor; o varken atlanır. Aksi hâlde fotoğraf
 *     yüklenirken sayfa yenilenip POST iptal olurdu — 2026-08-08'de
 *     `useStuckAutoReload` ile tam bu yaşandı (PendingButton.tsx:56).
 *  2. **Dosya seçiliyken tazeleme YOK.** Şoför kareyi seçmiş ama henüz
 *     göndermemişse yenileme seçimi uçururdu.
 *  3. **Sekme arka plandayken tazeleme YOK.** Görünmeyen sayfa için sunucuyu
 *     yormanın anlamı yok; şoför geri döndüğünde hemen bir kez tazelenir.
 */
export function OtoYenile({ saniye = 45 }: { saniye?: number }) {
  const router = useRouter();
  const sonRef = useRef(0);

  useEffect(() => {
    function meshgulMu(): boolean {
      // 1) Gönderim sürüyor mu (PendingButton aria-busy basar)
      if (document.querySelector('[aria-busy="true"]')) return true;
      // 2) Seçilmiş ama gönderilmemiş dosya var mı
      const dosyalar = document.querySelectorAll<HTMLInputElement>(
        'input[type="file"]',
      );
      for (const d of dosyalar) if (d.files && d.files.length > 0) return true;
      return false;
    }

    function tazele(zorla = false) {
      if (document.visibilityState !== "visible") return;
      if (meshgulMu()) return;
      const simdi = Date.now();
      if (!zorla && simdi - sonRef.current < saniye * 1000) return;
      sonRef.current = simdi;
      router.refresh();
    }

    const id = setInterval(() => tazele(), saniye * 1000);
    // Sekmeye geri dönünce beklemeden bir kez tazele — şoför telefonu cebinden
    // çıkardığında ilk gördüğü şey bayat liste olmasın.
    const gorunurluk = () => {
      if (document.visibilityState === "visible") tazele(true);
    };
    document.addEventListener("visibilitychange", gorunurluk);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", gorunurluk);
    };
  }, [router, saniye]);

  return null;
}
