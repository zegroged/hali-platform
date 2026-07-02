"use client";

import { useEffect, useState, type ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

/** Buton içi mini yükleniyor halkası. */
export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      className="animate-spin"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-6.2-8.56" />
    </svg>
  );
}

/**
 * Bekleme 10 sn'yi aşarsa sayfayı OTOMATİK yenile: aksiyon sunucuda çoktan
 * tamamlanmıştır (CAS'lı), taze sayfa doğru durumu gösterir. Kullanıcı hiçbir
 * durumda sonsuz "İşleniyor…"da kalmaz. (Asıl kök neden — deploy sonrası eski
 * çalışma zamanı — VersionSkewGuard ile anında yakalanır; bu ikinci ağdır.)
 */
export function useStuckAutoReload(pending: boolean, ms = 10_000): boolean {
  const [reloading, setReloading] = useState(false);
  useEffect(() => {
    if (!pending) {
      setReloading(false);
      return;
    }
    const t = setTimeout(() => {
      setReloading(true);
      window.location.reload();
    }, ms);
    return () => clearTimeout(t);
  }, [pending, ms]);
  return reloading;
}

/**
 * Server-action formları için gönder butonu: tıklanır tıklanmaz spinner +
 * devre dışı; yanıt uygulanamazsa 10 sn'de sayfa kendini yeniler.
 */
export function PendingButton({
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  const reloading = useStuckAutoReload(pending);

  return (
    <button type="submit" disabled={pending} aria-busy={pending} {...rest}>
      {pending ? (
        <span className="inline-flex items-center justify-center gap-1.5">
          <Spinner /> {reloading ? "Yenileniyor…" : "İşleniyor…"}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
