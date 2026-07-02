"use client";

import type { ButtonHTMLAttributes } from "react";
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
 * Server-action formları için gönder butonu: tıklanır tıklanmaz spinner +
 * devre dışı (aksiyon sunucuya gidip gelene kadar "hiçbir şey olmuyor" hissini
 * ve çift gönderimi engeller). action={...} kullanan bir <form> içine konur.
 */
export function PendingButton({
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
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
