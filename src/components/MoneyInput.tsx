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

/**
 * 🔴 MAKİNE BİÇİMİNDEN EKRAN BİÇİMİNE (2026-08-11) — 10-100 KATLIK PARA HATASI.
 *
 * `paraBicimle` KULLANICININ YAZDIĞINI biçimlendirmek için yazıldı: nokta
 * kullanıcıdan gelirse binlik ayıracıdır, silinir. Ama `defaultValue`
 * veritabanından geliyor ve orada nokta ONDALIK ayıracıdır:
 *
 *   Prisma Decimal(10,2) 1250.50  ->  String() = "1250.5"
 *   paraBicimle("1250.5")  ->  nokta silinir  ->  "12505"  ->  "12.505"
 *   parseTutar("12.505")   ->  binlik sanılır ->  12505     ← 10 KATI
 *
 * Gerçek kodla ölçüldü: 1250.5 → 12505 (10x), 1250.05 → 125005 (100x).
 * Şoför alana DOKUNMADAN "Teslim Et"e bassa bile yanlış tutar kaydediliyordu.
 * Canlıda henüz patlamamıştı çünkü 53 fiyatın hiçbiri kuruşlu değildi — ilk
 * "1.250,50" yazan halıcıda patlayacaktı.
 *
 * Bu fonksiyon makine biçimini (nokta = ondalık) doğru ekran biçimine çevirir.
 */
export function paraBicimleSayi(deger: unknown): string {
  if (deger == null || deger === "") return "";
  const n = Number(String(deger));
  if (!Number.isFinite(n)) return "";
  // Kuruş varsa iki hane göster, yoksa hiç gösterme (1250 → "1.250").
  const tam = Math.trunc(Math.abs(n));
  const kurus = Math.round((Math.abs(n) - tam) * 100);
  const tamNokta = String(tam).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const isaret = n < 0 ? "-" : "";
  return kurus === 0
    ? `${isaret}${tamNokta}`
    : `${isaret}${tamNokta},${String(kurus).padStart(2, "0")}`;
}

type Props = {
  name: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  /** KULLANICI BİÇİMİ ("1.250,50"). Veritabanı değeri için `defaultNumber` kullan. */
  defaultValue?: string;
  /** MAKİNE BİÇİMİ — Prisma Decimal / number / "1250.5". Doğru biçime çevrilir. */
  defaultNumber?: unknown;
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
  defaultNumber,
  suffix = "TL",
}: Props) {
  // `defaultNumber` verildiyse makine biçiminden çevrilir; `defaultValue`
  // kullanıcı biçimindedir ve eskisi gibi biçimlendiriciden geçer.
  const [deger, setDeger] = useState(
    defaultNumber !== undefined
      ? paraBicimleSayi(defaultNumber)
      : paraBicimle(defaultValue),
  );

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
