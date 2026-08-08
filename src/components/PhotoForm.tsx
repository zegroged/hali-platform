"use client";

import { useState } from "react";
import { PendingButton } from "@/components/PendingButton";

/**
 * Şoför alım/teslim formu: fotoğraf ZORUNLU ama eksikse TAM-EKRAN hata yerine
 * alanın hemen ALTINDA net bir uyarı gösterir (gönderimi engeller). Sunucu
 * tarafı da ayrıca zorunlu (arayüz atlatılırsa sessizce /sofor'a döner).
 */
export function PhotoForm({
  action,
  orderId,
  photoLabel,
  errorMessage,
  buttonLabel,
  children,
  footer,
}: {
  action: (fd: FormData) => void | Promise<void>;
  orderId: string;
  photoLabel: React.ReactNode;
  errorMessage: string;
  buttonLabel: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [err, setErr] = useState<string | null>(null);
  const fid = `foto-${orderId}`;
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const input = e.currentTarget.elements.namedItem(
          "photo",
        ) as HTMLInputElement | null;
        if (!input?.files?.length) {
          e.preventDefault(); // gönderme — tam-ekran hata çıkmasın
          setErr(errorMessage);
        } else {
          setErr(null);
        }
      }}
      className="space-y-2"
    >
      <input type="hidden" name="orderId" value={orderId} />
      {children}
      <label htmlFor={fid} className="block text-xs font-medium text-slate-600">
        {photoLabel}
      </label>
      <input
        id={fid}
        name="photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={() => setErr(null)}
        className="mt-1 w-full text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm"
      />
      {err && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
        >
          {err}
        </p>
      )}
      {/* otoYenileme=false ŞART: bu form dosya yüklüyor ve 10 sn'lik yenileme
          yüklemeyi ortasında kesiyordu (2026-08-08). */}
      <PendingButton
        otoYenileme={false}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-dark"
      >
        {buttonLabel}
      </PendingButton>
      {footer}
    </form>
  );
}
