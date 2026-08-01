import { prisma } from "@/lib/prisma";

// KOMİSYON ÖDEMESİ (çekim) yardımcıları — 2026-07-26.
// Komisyoncunun bakiyesi = ödenmemiş KENDİ payları + (baş komisyoncuysa)
// ödenmemiş HAVUZ FARKI payları. "skipped" satırları (pasif dönem) sayılmaz.

const kurus = (n: number) => Math.round(n * 100) / 100;

export async function agentBalance(agentId: string): Promise<{
  kendi: number;
  havuz: number;
  toplam: number;
}> {
  const [kendiAgg, havuzAgg] = await Promise.all([
    prisma.commissionEntry.aggregate({
      where: { agentId, skipped: false, paidAt: null },
      _sum: { amount: true },
    }),
    prisma.commissionEntry.aggregate({
      where: { headAgentId: agentId, skipped: false, headPaidAt: null },
      _sum: { headAmount: true },
    }),
  ]);
  const kendi = kurus(Number(kendiAgg._sum.amount ?? 0));
  const havuz = kurus(Number(havuzAgg._sum.headAmount ?? 0));
  return { kendi, havuz, toplam: kurus(kendi + havuz) };
}

/** Ödeme yapıldı: o ana kadarki TÜM ödenmemiş tahakkukları kapat ve talebi
 *  PAID işaretle. Tutar ödeme ANINDA yeniden hesaplanır (talepten sonra yeni
 *  tahakkuk geldiyse o da kapanır — kullanıcı toplam bakiyeyi havale ediyor).
 *  Tek transaction: yarım kapanma olmaz. */
export async function markPayoutPaid(
  requestId: string,
  adminNote?: string,
): Promise<{
  ok: boolean;
  tutar?: number;
  stopaj?: number;
  net?: number;
  hata?: string;
}> {
  const istek = await prisma.payoutRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      agentId: true,
      status: true,
      agent: { select: { faturaMukellefi: true } },
    },
  });
  if (!istek) return { ok: false, hata: "Talep bulunamadı." };
  if (istek.status !== "PENDING")
    return { ok: false, hata: "Bu talep zaten kapatılmış." };

  const bakiye = await agentBalance(istek.agentId);
  const simdi = new Date();

  // STOPAJ — OTOMATİK (2026-07-31 kullanıcı kararı): komisyoncu fatura
  // mükellefi DEĞİLSE ve bu ayki brüt tahakkuku eşiği aştıysa, kesinti ödeme
  // ANINDA hesaplanır ve talebe KALICI yazılır (oran sonradan değişse de
  // tarihi kayıt sabit kalır — mali müşavir dökümü buradan okur). Mükellefe
  // stopaj uygulanmaz: o fatura keser, brüt ödenir.
  let stopajOran: number | null = null;
  let stopajTutar: number | null = null;
  let netTutar: number | null = null;
  if (!istek.agent.faturaMukellefi) {
    const { ayTahakkuklari, stopajHesapla, STOPAJ_ESIK, STOPAJ_ORAN } =
      await import("@/lib/stopaj");
    const ayToplam =
      (await ayTahakkuklari([istek.agentId], simdi)).get(istek.agentId) ?? 0;
    if (ayToplam >= STOPAJ_ESIK) {
      const d = stopajHesapla(bakiye.toplam);
      stopajOran = STOPAJ_ORAN * 100;
      stopajTutar = d.stopaj;
      netTutar = d.net;
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // KOŞULLU claim (TOCTOU): yalnız hâlâ PENDING olan talebi kapat.
      const claim = await tx.payoutRequest.updateMany({
        where: { id: istek.id, status: "PENDING" },
        data: {
          status: "PAID",
          paidAt: simdi,
          paidAmount: bakiye.toplam,
          stopajOran,
          stopajTutar,
          netTutar,
          adminNote: adminNote?.trim() || null,
        },
      });
      if (claim.count === 0) throw new Error("zaten-kapali");
      await tx.commissionEntry.updateMany({
        where: { agentId: istek.agentId, skipped: false, paidAt: null },
        data: { paidAt: simdi },
      });
      await tx.commissionEntry.updateMany({
        where: { headAgentId: istek.agentId, skipped: false, headPaidAt: null },
        data: { headPaidAt: simdi },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "zaten-kapali")
      return { ok: false, hata: "Bu talep az önce kapatıldı." };
    throw e;
  }
  return {
    ok: true,
    tutar: bakiye.toplam,
    stopaj: stopajTutar ?? undefined,
    net: netTutar ?? undefined,
  };
}

/** AYLIK OTOMATİK TALEP: komisyoncu "her ayın X'i" seçtiyse o gün bakiyesi
 *  varsa talep kendiliğinden oluşur (admin panelinde görünür). Ay başına TEK
 *  kez: aynı ay içinde talep varsa atlanır. Saatlik tik'ten çağrılır. */
// AY SONU TOPLU ÖDEME (2026-07-31, kullanıcı kararı: "ödemeleri her ayın
// sonuna indirgeyelim, herkes her ay düzenli alsın").
// Eski model: her komisyoncu kendi gününü seçer + istediği an elle talep açar
// → admin'e dağınık, öngörüsüz iş. Yeni model: ayın SON GÜNÜ (TR takvimi)
// bakiyesi olan HERKESE otomatik talep açılır; admin ay sonunda TEK toplu
// listeyle havaleleri yapar (stopaj zaten otomatik hesaplanıp yazılıyor).
// Elle talep butonu ve kişisel gün seçimi KALDIRILDI (Agent.payoutDay artık
// okunmuyor — kolon eski kayıtlar için duruyor).
export async function createScheduledPayoutRequests(): Promise<void> {
  const simdi = new Date();
  // TR takvim günü — konteyner UTC'de; gece yarısı sınırında yanlış gün olmasın.
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
  })
    .format(simdi)
    .split("-")
    .map(Number);
  const sonGun = new Date(y, m, 0).getDate(); // m: 1-12 → o ayın son günü
  if (d !== sonGun) return;

  // Ay başına TEK koşu (saatlik tik her saat çağırır; marker atomik).
  const anahtar = `payout-ay-${y}-${String(m).padStart(2, "0")}`;
  const kilit = await prisma.appState.createMany({
    data: [{ key: anahtar, value: new Date().toISOString() }],
    skipDuplicates: true,
  });
  if (kilit.count === 0) return; // bu ay koşuldu

  const agents = await prisma.agent.findMany({
    where: { active: true },
    select: { id: true, userId: true, iban: true, ibanName: true },
  });
  for (const a of agents) {
    const bekleyen = await prisma.payoutRequest.count({
      where: { agentId: a.id, status: "PENDING" },
    });
    if (bekleyen > 0) continue; // zaten açık talep var (tek-bekleyen kuralı)
    const bakiye = await agentBalance(a.id);
    if (bakiye.toplam <= 0) continue;
    if (!a.iban || !a.ibanName) {
      // Bakiye var ama havale bilgisi eksik: talep AÇILMAZ (admin IBAN'sız
      // havale yapamaz), komisyoncuya zil çalar — ekleyince gelecek ay girer.
      try {
        const { notify } = await import("@/lib/notify");
        await notify({
          userId: a.userId,
          type: "genel",
          title: "Ay sonu ödemen bekletildi",
          body: `${bakiye.toplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL bakiyen var ama IBAN/hesap sahibi adı eksik. Panelindeki "Ödemem" bölümünden ekle — bir sonraki ay sonunda otomatik ödenir.`,
          href: "/komisyoncu",
        });
      } catch (e) {
        console.error("[ay-sonu-odeme] zil hatası:", e);
      }
      continue;
    }
    await prisma.payoutRequest.create({
      data: {
        agentId: a.id,
        amount: bakiye.toplam,
        iban: a.iban,
        ibanName: a.ibanName,
        auto: true,
        note: "Ay sonu otomatik ödeme",
      },
    });
  }
}
