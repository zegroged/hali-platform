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
 * Bekleme uzarsa (deploy sırasında bayatlayan sayfa, kopan bağlantı...)
 * kullanıcıyı kurtarma moduna geçir: buton "yenile"ye dönüşür.
 */
export function usePendingTimeout(pending: boolean, ms = 12000): boolean {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!pending) {
      setTimedOut(false);
      return;
    }
    const t = setTimeout(() => setTimedOut(true), ms);
    return () => clearTimeout(t);
  }, [pending, ms]);
  return timedOut;
}

/**
 * Server-action formları için gönder butonu: tıklanır tıklanmaz spinner +
 * devre dışı (aksiyon sunucuya gidip gelene kadar "hiçbir şey olmuyor" hissini
 * ve çift gönderimi engeller). Yanıt 12 sn'de gelmezse "yenile" moduna geçer —
 * işlem büyük olasılıkla sunucuda tamamlanmıştır, taze sayfa durumu gösterir.
 */
export function PendingButton({
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  const timedOut = usePendingTimeout(pending);

  if (pending && timedOut) {
    return (
      <button
        type="button"
        {...rest}
        disabled={false}
        onClick={() => window.location.reload()}
      >
        Yanıt gecikti — yenile
      </button>
    );
  }
  return (
    <button type="submit" disabled={pending} aria-busy={pending} {...rest}>
      {pending ? (
        <span className="inline-flex items-center justify-center gap-1.5">
          <Spinner /> İşleniyor…
        </span>
      ) : (
        children
      )}
    </button>
  );
}
