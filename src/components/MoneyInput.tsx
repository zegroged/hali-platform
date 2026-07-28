"use client";

import { useState } from "react";

// PARA ALANI (2026-07-28 kullanıcı isteği: "100000 yazınca anlaşılması zor
// oluyor, yazarken nokta koysun").
//
// Yazarken TR biçimine çevirir: 100000 → 100.000 · 1250,5 → 1.250,5
// Binlik ayıracı NOKTA, kuruş ayıracı VİRGÜL (Türkiye'de klavye alışkanlığı bu).
//
// Sunucu tarafı bu biçimi zaten okuyor (`tutarOku`, `parseTutar`): binlik
// noktaları silip virgülü noktaya çeviriyor. Yani ekranda ne görünürse görünsün
// kaydedilen sayı doğru — biçimlendirme sadece GÖZ İÇİN.
//
// ⚠️ YÜZDE ve m² alanlarında KULLANMA: oralar küçük sayılar, binlik ayıracı
// anlamsız olur (%15 → 15 kalmalı, 12,5 m² → 12,5 kalmalı).

/** "100000" → "100.000" · "1250,567" → "1.250,56" (kuruş 2 haneyle sınırlı). */
export function paraBicimle(ham: string): string {
  // Yalnız rakam ve virgül kalsın (kullanıcı nokta yazsa da biz koyacağız).
  let s = ham.replace(/[^\d,]/g, "");
  // Tek virgül: ikincisini ve sonrasını at.
  const ilk = s.indexOf(",");
  if (ilk !== -1) s = s.slice(0, ilk + 1) + s.slice(ilk + 1).replace(/,/g, "");

  const virgullu = s.includes(",");
  let [tam = "", kurus = ""] = s.split(",");
  // Baştaki gereksiz sıfırlar ("007" → "7"), ama tek "0" korunsun.
  tam = tam.replace(/^0+(?=\d)/, "");
  if (tam === "" && virgullu) tam = "0";
  // Binlik ayıracı.
  const tamNokta = tam.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (!virgullu) return tamNokta;
  return tamNokta + "," + kurus.slice(0, 2);
}

type Props = {
  name: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  defaultValue?: string;
  /** Alanın sağında "TL" rozeti gösterilsin mi (varsayılan: evet). */
  suffix?: string | null;
};

export default function MoneyInput({
  name,
  id,
  required,
  placeholder = "Ör. 1.250,50",
  className = "",
  defaultValue = "",
  suffix = "TL",
}: Props) {
  const [deger, setDeger] = useState(paraBicimle(defaultValue));

  const alan = (
    <input
      id={id}
      name={name}
      required={required}
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      value={deger}
      onChange={(e) => setDeger(paraBicimle(e.target.value))}
      className={suffix ? `${className} pr-10` : className}
    />
  );

  if (!suffix) return alan;
  return (
    <div className="relative">
      {alan}
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">
        {suffix}
      </span>
    </div>
  );
}
