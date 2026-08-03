"use client";
import { useState } from "react";

const fmt = (n: number) =>
  n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });

/**
 * m² fiyat hesaplayıcısı — müşteri "benim halım kaça gelir?" sorusunu profil
 * üzerinde çözsün (sipariş cesareti). Yalnız m² bazlı ana hizmet fiyatlarından
 * hesaplar; kesin fiyat ölçüm sonrası bildirilir (md.15/1-h akışı değişmez).
 */
export default function PriceEstimator({ prices }: { prices: number[] }) {
  const [m2, setM2] = useState("");
  const val = Number(m2.replace(",", "."));
  const ok = Number.isFinite(val) && val > 0 && val <= 1000;
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  return (
    <div className="mt-3 rounded-lg border border-brand/30 bg-brand-light/40 p-3">
      <label
        htmlFor="m2-hesap"
        className="text-sm font-semibold text-slate-900"
      >
        Kaça gelir? Halının m²&apos;sini gir
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          id="m2-hesap"
          type="number"
          inputMode="decimal"
          min={1}
          max={1000}
          step="0.5"
          value={m2}
          onChange={(e) => setM2(e.target.value)}
          placeholder="örn. 12"
          className="w-24 rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand"
        />
        <span className="text-sm text-slate-600">m²</span>
        {ok && (
          <span className="ml-auto text-sm font-bold text-brand-dark">
            ≈ {min === max ? fmt(min * val) : `${fmt(min * val)}–${fmt(max * val)}`}{" "}
            TL
          </span>
        )}
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        Tahminî tutardır; kesin fiyat halın ölçülünce bildirilir, onaylamazsan
        ücretsiz iade edilir.
      </p>
    </div>
  );
}
