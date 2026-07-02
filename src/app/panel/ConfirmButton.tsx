"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { Spinner, usePendingTimeout } from "@/components/PendingButton";

/**
 * Yıkıcı form aksiyonları (sil, iptal…) için onay soran gönder butonu.
 * Onaylanınca spinner + devre dışı; yanıt 12 sn'de gelmezse "yenile" moduna
 * geçer (bkz PendingButton).
 */
export function ConfirmButton({
  message,
  children,
  ...rest
}: { message: string } & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "type"
>) {
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
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      {...rest}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
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
