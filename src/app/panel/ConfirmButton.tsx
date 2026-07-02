"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { Spinner, useStuckAutoReload } from "@/components/PendingButton";

/**
 * Yıkıcı form aksiyonları (sil, iptal…) için onay soran gönder butonu.
 * Onaylanınca spinner + devre dışı; yanıt uygulanamazsa 10 sn'de sayfa
 * kendini yeniler (bkz PendingButton).
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
  const reloading = useStuckAutoReload(pending);

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
          <Spinner /> {reloading ? "Yenileniyor…" : "İşleniyor…"}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
