"use client";

// HATA / BAŞARI ŞERİDİ — TEK KAYNAK (2026-08-06).
//
// Her panel sayfası `?hata=` ve `?kaydedildi=` parametrelerini AYNI görünümde
// göstersin diye. Önceden yalnız /panel/profil'de vardı ve her sayfa kendi
// işaretlemesini yazıyordu; sonuç: çoğu sayfada hiç gösterilmiyordu ve
// kullanıcı "Bir şeyler ters gitti" jenerik ekranıyla baş başa kalıyordu.
//
// `role="alert"`: ekran okuyucu hatayı ANINDA okur; sessiz kırmızı kutu
// görme güçlüğü olan kullanıcı için yok hükmündedir.
//
// 🔴 YAPIŞKANLIK GİDERİLDİ (2026-08-11, doğrulama denetimi bulgusu).
// Mesaj URL'de (`?hata=`) taşınıyor. Başarılı aksiyonlar `revalidatePath` ile
// bitip yönlendirme YAPMADIĞI için parametre URL'de kalıyordu; üstüne şoför
// sayfasına 45 saniyelik `OtoYenile` eklenince `router.refresh()` her turda
// aynı şeridi diriltiyordu. Sonuç: "PARAYI ALDIYSAN halıcını ara" gibi ağır
// bir uyarı mesai boyunca ekranda kalıyor, şoför ya boşuna telaşlanıyor ya da
// kırmızı şeritleri umursamamayı öğreniyordu — ikincisi daha tehlikeli.
//
// Çözüm: mesaj gösterildikten sonra parametre adres çubuğundan silinir
// (`replaceState` — geçmişe yeni kayıt eklemez, geri tuşunu bozmaz). Metin
// ekranda kalır, kullanıcı kapatabilir.

import { useEffect, useState } from "react";

function paramSil(ad: string) {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  if (!u.searchParams.has(ad)) return;
  u.searchParams.delete(ad);
  window.history.replaceState(null, "", u.pathname + u.search + u.hash);
}

export function HataSeridi({ mesaj }: { mesaj?: string }) {
  const [gizli, setGizli] = useState(false);
  useEffect(() => {
    if (mesaj) paramSil("hata");
  }, [mesaj]);
  if (!mesaj || gizli) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
    >
      <p className="min-w-0 flex-1">{mesaj}</p>
      <button
        type="button"
        onClick={() => setGizli(true)}
        aria-label="Uyarıyı kapat"
        className="shrink-0 rounded px-1.5 text-red-500 hover:text-red-700"
      >
        ✕
      </button>
    </div>
  );
}

export function BasariSeridi({ mesaj }: { mesaj?: string }) {
  const [gizli, setGizli] = useState(false);
  useEffect(() => {
    if (mesaj) paramSil("kaydedildi");
  }, [mesaj]);
  if (!mesaj || gizli) return null;
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
    >
      <p className="min-w-0 flex-1">{mesaj}</p>
      <button
        type="button"
        onClick={() => setGizli(true)}
        aria-label="Bildirimi kapat"
        className="shrink-0 rounded px-1.5 text-emerald-600 hover:text-emerald-800"
      >
        ✕
      </button>
    </div>
  );
}
