import { prisma } from "@/lib/prisma";
import type { LedgerCategory, LedgerKind } from "@prisma/client";

// KASA (gelir-gider) hesap motoru — 2026-07-26.
// GELİR: teslim edilen (DELIVERED) siparişlerin fiyatı OTOMATİK sayılır; halıcı
// elle gelir de ekleyebilir. GİDER: tamamen elle (personel, deterjan, kira...).
// Tekrarlayan kalemler (her N gün / her ayın X'i) vadesi gelince kendiliğinden
// kayda düşer — halıcı her seferinde girmek zorunda kalmasın.

const kurus = (n: number) => Math.round(n * 100) / 100;

export const KATEGORI_ETIKET: Record<LedgerCategory, string> = {
  PERSONEL: "Personel",
  MALZEME: "Malzeme / Deterjan",
  KIRA: "Kira",
  FATURA: "Fatura (elektrik, su, doğalgaz)",
  YAKIT: "Yakıt",
  ARAC: "Araç",
  VERGI: "Vergi / SGK / Muhasebe",
  DIGER: "Diğer",
};

export type AyOzeti = {
  ay: Date; // ayın ilk günü
  siparisGeliri: number; // teslim edilen siparişlerden (otomatik)
  siparisAdedi: number;
  elleGelir: number;
  gider: number;
  toplamGelir: number;
  kar: number; // toplamGelir - gider
  kategoriler: { kategori: LedgerCategory; tutar: number }[];
};

/** Ayın ilk/son anı (yerel saat — TR sunucusu). */
export function ayAraligi(yil: number, ay0: number) {
  const bas = new Date(yil, ay0, 1, 0, 0, 0, 0);
  const son = new Date(yil, ay0 + 1, 1, 0, 0, 0, 0);
  return { bas, son };
}

export async function ayOzeti(
  businessId: string,
  yil: number,
  ay0: number,
): Promise<AyOzeti> {
  const { bas, son } = ayAraligi(yil, ay0);

  const [siparisAgg, gelirAgg, giderAgg, kategoriGrup] = await Promise.all([
    // OTOMATİK GELİR: teslim edilmiş + fiyatı girilmiş siparişler, TESLİM
    // TARİHİNE göre (deliveredAt). Eski kayıtlarda deliveredAt boş olabilir →
    // onlar için updatedAt'e düşülür (geriye dönük uyum).
    prisma.order.aggregate({
      where: {
        businessId,
        status: "DELIVERED",
        priceTotal: { not: null },
        OR: [
          { deliveredAt: { gte: bas, lt: son } },
          { deliveredAt: null, updatedAt: { gte: bas, lt: son } },
        ],
      },
      _sum: { priceTotal: true },
      _count: true,
    }),
    prisma.ledgerEntry.aggregate({
      where: { businessId, kind: "INCOME", date: { gte: bas, lt: son } },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: { businessId, kind: "EXPENSE", date: { gte: bas, lt: son } },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.groupBy({
      by: ["category"],
      where: { businessId, kind: "EXPENSE", date: { gte: bas, lt: son } },
      _sum: { amount: true },
    }),
  ]);

  const siparisGeliri = kurus(Number(siparisAgg._sum.priceTotal ?? 0));
  const elleGelir = kurus(Number(gelirAgg._sum.amount ?? 0));
  const gider = kurus(Number(giderAgg._sum.amount ?? 0));
  const toplamGelir = kurus(siparisGeliri + elleGelir);

  return {
    ay: bas,
    siparisGeliri,
    siparisAdedi: siparisAgg._count,
    elleGelir,
    gider,
    toplamGelir,
    kar: kurus(toplamGelir - gider),
    kategoriler: kategoriGrup
      .map((k) => ({ kategori: k.category, tutar: kurus(Number(k._sum.amount ?? 0)) }))
      .sort((a, b) => b.tutar - a.tutar),
  };
}

/** Bir sonraki üretim zamanını hesapla (her N gün / her ayın X'i). */
export function sonrakiTarih(
  simdi: Date,
  everyDays: number | null,
  monthDay: number | null,
): Date {
  if (everyDays && everyDays > 0) {
    const d = new Date(simdi);
    d.setDate(d.getDate() + everyDays);
    return d;
  }
  const gun = Math.min(Math.max(monthDay ?? 1, 1), 28);
  const d = new Date(simdi.getFullYear(), simdi.getMonth(), gun, 9, 0, 0, 0);
  if (d.getTime() <= simdi.getTime()) d.setMonth(d.getMonth() + 1);
  return d;
}

/** TEKRARLAYAN KALEM BEKÇİSİ: vadesi geçmiş kuralları işleyip kayıt üretir.
 *  Saatlik tik'ten çağrılır. Geriye dönük birikmişleri de kapatır (ör. sunucu
 *  bir hafta kapalı kaldıysa) ama en fazla 40 adım — sonsuz döngü olmasın. */
export async function runLedgerRecurrences(): Promise<void> {
  const simdi = new Date();
  const kurallar = await prisma.ledgerRecurrence.findMany({
    where: { active: true, nextRunAt: { lte: simdi } },
    take: 200,
  });
  for (const k of kurallar) {
    let vade = k.nextRunAt;
    let adim = 0;
    while (vade.getTime() <= simdi.getTime() && adim < 40) {
      await prisma.ledgerEntry.create({
        data: {
          businessId: k.businessId,
          kind: k.kind as LedgerKind,
          category: k.category as LedgerCategory,
          label: k.label,
          amount: k.amount,
          date: vade,
          recurrenceId: k.id,
          note: "Otomatik (tekrarlayan kalem)",
        },
      });
      vade = sonrakiTarih(vade, k.everyDays, k.monthDay);
      adim++;
    }
    await prisma.ledgerRecurrence.update({
      where: { id: k.id },
      data: { nextRunAt: vade },
    });
  }
}
