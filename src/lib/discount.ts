import { PLAN } from "@/lib/plan";

// ABONELİK İNDİRİMİ (2026-07-23): premium komisyoncu kodla, admin elle tanımlar.
// İndirim işletme kaydında durur (discountPercent + discountUntil) ve süresi
// geçerliyken HER tahsilatta uygulanır — komisyon da fiilen tahsil edilen
// tutardan hesaplandığı için otomatik orantılı düşer.

const kurus = (n: number) => Math.round(n * 100) / 100;

// BAŞ KOMİSYONCUNUN alt komisyoncusuna verebileceği EN YÜKSEK indirim tavanı.
// Kullanıcı kararı 2026-07-26: baş komisyoncu bu sınırın altında istediği
// tavanı seçebilir; üstünü yalnız admin (doğrudan yetki vererek) açabilir.
export const MAX_SUB_DISCOUNT = 20;
// Aynı mantıkla SÜRE tavanı: baş komisyoncu bunun altında seçer. 12 ay makul
// bir üst sınır (kalıcı indirim taahhüdü admin kararı olmalı) — değiştirmek
// isterseniz tek yer burası.
export const MAX_SUB_DISCOUNT_MONTHS = 12;

export type DiscountLike = {
  discountPercent: unknown; // Prisma Decimal | null
  discountUntil: Date | null;
};

/** Şu an geçerli indirim yüzdesi (yoksa/bittiyse null). */
export function activeDiscountPercent(b: DiscountLike): number | null {
  const pct = Number(b.discountPercent ?? 0);
  if (!(pct > 0) || pct > 100) return null;
  if (!b.discountUntil || b.discountUntil.getTime() <= Date.now()) return null;
  return pct;
}

/** Bu işletmeden bu ay tahsil edilecek KDV DAHİL tutar (indirim uygulanmış).
 *  1 TL altına düşerse 0 sayılır (iyzico'dan kuruş çekilmez — dönem ÜCRETSİZ
 *  açılır; %100 indirimin yolu budur). */
export function effectiveSubscriptionGross(b: DiscountLike): {
  gross: number;
  pct: number | null;
} {
  const pct = activeDiscountPercent(b);
  if (pct == null) return { gross: PLAN.priceGrossNumber, pct: null };
  const gross = kurus(PLAN.priceGrossNumber * (1 - pct / 100));
  return { gross: gross < 1 ? 0 : gross, pct };
}

/** Kod/admin "kaç ay" girdisinden bitiş tarihi (şimdiden itibaren).
 *  Ay sonu taşmasını kelepçeler: 31 Oca + 1 ay = 28/29 Şub (3 Mar değil). */
export function discountUntilFromMonths(months: number): Date {
  const d = new Date();
  const gun = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < gun) d.setDate(0); // taştı → hedef ayın son günü
  return d;
}
