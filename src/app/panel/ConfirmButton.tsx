"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/PendingButton";

/**
 * Yıkıcı form aksiyonları (sil, iptal…) için onay soran gönder butonu.
 * Server component form'larının (action={...}) içinde kullanılır;
 * kullanıcı onaylamazsa form gönderimi engellenir. Onaylanınca spinner +
 * devre dışı — sunucu yanıtı gelene kadar buton tepkisiz görünmesin.
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
