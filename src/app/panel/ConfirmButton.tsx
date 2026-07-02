"use client";

import type { ButtonHTMLAttributes } from "react";

/**
 * Yıkıcı form aksiyonları (sil, iptal…) için onay soran gönder butonu.
 * Server component form'larının (action={...}) içinde kullanılır;
 * kullanıcı onaylamazsa form gönderimi engellenir.
 */
export function ConfirmButton({
  message,
  ...rest
}: { message: string } & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "type"
>) {
  return (
    <button
      type="submit"
      {...rest}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    />
  );
}
