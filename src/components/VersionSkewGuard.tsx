"use client";

import { useEffect } from "react";

// Deploy sonrası açık kalan sekmelerde eski JS çalışma zamanı, yeni sürümün
// parça (chunk) dosyalarını bulamaz — buton tıklamaları/sayfa geçişleri sessizce
// yarıda kalır. Bu bekçi o hatayı yakalar yakalamaz sayfayı yeniler: kullanıcı
// taze sürümü alır, sunucuda tamamlanmış işlemin sonucunu görür.

const PATTERNS =
  /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed|Failed to load resource.*_next\/static/i;

// Yenileme döngüsü koruması: 30 sn içinde en fazla bir otomatik yenileme.
function shouldReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem("skew-reload") || 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem("skew-reload", String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

export default function VersionSkewGuard() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      const msg = e.message || String(e.error?.message ?? "");
      if (PATTERNS.test(msg) && shouldReload()) window.location.reload();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: string } | string | undefined;
      const msg = typeof r === "string" ? r : String(r?.message ?? "");
      if (PATTERNS.test(msg) && shouldReload()) window.location.reload();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
