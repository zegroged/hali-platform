import { PLAN, tahsilEdilecekBrut, type Paket } from "@/lib/plan";
import { merdivenAktif } from "@/lib/config";

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
  /** MERDİVEN AÇIKKEN ZORUNLU: liste fiyatı artık işletmeye göre değişiyor
   *  (paket + koltuk + kurucu kilidi). Merdiven kapalıyken okunmaz. */
  subscription?: {
    plan?: unknown;
    driverSeats?: unknown;
    priceGrossLocked?: unknown;
    priceLockedUntil?: Date | null;
  } | null;
};

/** Bu işletmenin İNDİRİMSİZ liste fiyatı (KDV dahil).
 *
 *  Merdiven kapalıyken tek fiyat vardır ve davranış 2026-08-09 öncesiyle
 *  birebir aynıdır. Açıkken işletmenin kendi basamağı okunur.
 *
 *  🔴 SESSİZ VARSAYILAN YOK: merdiven açıkken abonelik kaydı gelmezse
 *  FIRLATIR. Buradaki sessiz bir varsayılan (2.400 ya da 900) yanlış tutarın
 *  karttan çekilmesi demektir; gürültülü hata, yanlış tahsilattan iyidir.
 */
function listeBrut(b: DiscountLike): number {
  if (!merdivenAktif) return PLAN.priceGrossNumber;
  const s = b.subscription;
  if (!s) {
    throw new Error(
      "effectiveSubscriptionGross: merdiven açıkken abonelik kaydı (plan, driverSeats, priceGrossLocked) sorguya dahil edilmeli.",
    );
  }
  const p = s.plan;
  const paket: Paket =
    p === "FILO" || p === "YONETIM" || p === "VITRIN" ? p : "VITRIN";
  return tahsilEdilecekBrut(paket, Number(s.driverSeats ?? 1), {
    priceGrossLocked: s.priceGrossLocked,
    priceLockedUntil: s.priceLockedUntil ?? null,
  });
}

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
  const liste = listeBrut(b);
  const pct = activeDiscountPercent(b);
  if (pct == null) return { gross: liste, pct: null };
  // ⚠️ İNDİRİM MERDİVEN DIŞI TUTAR ÜRETİR (ör. 1.200 × 0,8 = 960) ve o tutarın
  // iyzico'da planı yoktur → `recurringPlanFor` null döner, düzenli ödeme
  // talimatı AÇILMAZ. Bu bir kusur değil, mevcut kuralın devamı: indirimli
  // işletme bugün de talimat veremiyor (odeme/abonelik/page.tsx), elle ödüyor.
  const gross = kurus(liste * (1 - pct / 100));
  return { gross: gross < 1 ? 0 : gross, pct };
}

/** Kod/admin "kaç ay" girdisinden bitiş tarihi.
 *  Ay sonu taşmasını kelepçeler: 31 Oca + 1 ay = 28/29 Şub (3 Mar değil).
 *  `basla` verilirse (ücretsiz deneme bitişi) pencere ORADAN başlar — denetim
 *  bulgusu: deneme ile indirim aynı anda başlayınca bedava ay indirim
 *  süresinden yeniyordu, "1 ay bedava + 12 ay indirim" sözü 11 aya düşüyordu. */
export function discountUntilFromMonths(months: number, basla?: Date | null): Date {
  const d = new Date(
    basla && basla.getTime() > Date.now() ? basla.getTime() : Date.now(),
  );
  const gun = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < gun) d.setDate(0); // taştı → hedef ayın son günü
  return d;
}

// DENEME SÜRESİ (2026-08-02, kullanıcı kararı): komisyoncu satışı kapatmak için
// ücretsiz deneme verebilir. Yalnız İKİ seçenek vardır — 15 gün ve 1 ay — ki
// saha konuşması basit kalsın ("iki hafta mı bir ay mı?").
export const TRIAL_SECENEKLERI = [15, 30] as const;
/** Platform tavanı: kimse 30 günden uzun ücretsiz deneme veremez. */
export const MAX_TRIAL_DAYS = 30;
/** Gün sayısını geçerli seçeneğe oturtur; geçersizse null. */
export function trialGunOku(raw: string): number | null {
  const n = Number(String(raw || "").trim());
  if (!Number.isInteger(n) || n <= 0) return null;
  return (TRIAL_SECENEKLERI as readonly number[]).includes(n) ? n : null;
}
