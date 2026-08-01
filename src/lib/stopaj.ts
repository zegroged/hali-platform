import { prisma } from "@/lib/prisma";

// KOMİSYONCU STOPAJI (2026-07-31, işletme sahibinin kuralı):
// "aylık 10 bin TL gelire ulaşan komisyoncuda %15 stopaj".
//
// ⚠️ VERGİ UYARISI — BU DOSYA HUKUKİ DANIŞMANLIK DEĞİLDİR: eşik, oran ve
// belge türü (gider pusulası) MALİ MÜŞAVİR TEYİDİNE muhtaçtır. İki meşru yol:
//   a) Komisyoncu vergi mükellefiyse (şahıs/şirket) bize FATURA keser —
//      stopajı kendi tarafı yönetir, platform kesinti yapmaz.
//   b) Mükellef değilse platform GİDER PUSULASI düzenler ve stopajı keserek
//      NET öder (belge /admin/pusula/[talep] sayfasından yazdırılır).
// Hangi yolun uygulanacağına admin, komisyoncunun durumuna göre karar verir.
//
// 🔴 BU MODÜL PARA MATEMATİĞİNE DOKUNMAZ: CommissionEntry/PayoutRequest
// tutarları BRÜT kalır; stopaj yalnız admin ekranında ve pusulada GÖSTERİLİR.
// Havaleyi admin nete göre yapar, "Ödendi işaretle"ye brütü kapatır.

/** Aylık brüt tahakkuk eşiği (TL) — üstünde stopaj gösterilir. */
export const STOPAJ_ESIK = 10_000;
/** Stopaj oranı — işletme sahibinin bildirdiği %15 (mali müşavir teyitli olmalı). */
export const STOPAJ_ORAN = 0.15;

export type StopajDokumu = {
  brut: number;
  oran: number;
  stopaj: number;
  net: number;
};

/** Kuruşa yuvarlanmış stopaj dökümü. */
export function stopajHesapla(brut: number): StopajDokumu {
  const stopaj = Math.round(brut * STOPAJ_ORAN * 100) / 100;
  return {
    brut,
    oran: STOPAJ_ORAN,
    stopaj,
    net: Math.round((brut - stopaj) * 100) / 100,
  };
}

/**
 * Komisyoncuların BU TAKVİM AYINDAKİ brüt tahakkuk toplamları (skipped hariç).
 * Admin ekranı bekleyen talepleri işaretlerken kullanır — tek sorguda toplu.
 */
export async function ayTahakkuklari(
  agentIds: string[],
  simdi: Date = new Date(),
): Promise<Map<string, number>> {
  if (agentIds.length === 0) return new Map();
  // AY BAŞI TR TAKVİMİNE GÖRE (denetim bulgusu): konteyner UTC'de —
  // getFullYear/getMonth yerel(UTC) ayı verir; TR gece 00:00-03:00 arası
  // oluşan tahakkuklar yanlış ayın penceresine düşüyordu. TR = UTC+3 sabit.
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" })
    .format(simdi)
    .split("-")
    .map(Number);
  const ayBasi = new Date(Date.UTC(y, m - 1, 1) - 3 * 60 * 60 * 1000);
  // ÜST SINIR ŞART: `simdi` GEÇMİŞ bir ay olabilir (stopaj eşiği TALEBİN
  // AÇILDIĞI aya göre ölçülür — ödeme ertesi ayda yapılsa bile). Üst sınırsız
  // sorgu yeni ayın tahakkuklarını da katardı.
  const sonrakiAyBasi = new Date(Date.UTC(y, m, 1) - 3 * 60 * 60 * 1000);
  // ⚠️ İKİ KAYNAK: alt payı `amount` (agentId) + baş komisyoncunun havuz farkı
  // AYNI satırın `headAmount` alanında (headAgentId). Yalnız amount toplansaydı
  // baş komisyoncunun aylık geliri eksik ölçülür, stopaj eşiği yanlış atlanırdı.
  const [altlar, baslar] = await Promise.all([
    prisma.commissionEntry.groupBy({
      by: ["agentId"],
      where: {
        agentId: { in: agentIds },
        skipped: false,
        createdAt: { gte: ayBasi, lt: sonrakiAyBasi },
      },
      _sum: { amount: true },
    }),
    prisma.commissionEntry.groupBy({
      by: ["headAgentId"],
      where: {
        headAgentId: { in: agentIds },
        skipped: false,
        createdAt: { gte: ayBasi, lt: sonrakiAyBasi },
      },
      _sum: { headAmount: true },
    }),
  ]);
  const toplamlar = new Map<string, number>();
  for (const g of altlar)
    toplamlar.set(g.agentId, Number(g._sum.amount ?? 0));
  for (const g of baslar) {
    if (!g.headAgentId) continue;
    toplamlar.set(
      g.headAgentId,
      (toplamlar.get(g.headAgentId) ?? 0) + Number(g._sum.headAmount ?? 0),
    );
  }
  return toplamlar;
}
