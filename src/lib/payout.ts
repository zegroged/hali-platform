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
): Promise<{ ok: boolean; tutar?: number; hata?: string }> {
  const istek = await prisma.payoutRequest.findUnique({
    where: { id: requestId },
    select: { id: true, agentId: true, status: true },
  });
  if (!istek) return { ok: false, hata: "Talep bulunamadı." };
  if (istek.status !== "PENDING")
    return { ok: false, hata: "Bu talep zaten kapatılmış." };

  const bakiye = await agentBalance(istek.agentId);
  const simdi = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      // KOŞULLU claim (TOCTOU): yalnız hâlâ PENDING olan talebi kapat.
      const claim = await tx.payoutRequest.updateMany({
        where: { id: istek.id, status: "PENDING" },
        data: {
          status: "PAID",
          paidAt: simdi,
          paidAmount: bakiye.toplam,
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
  return { ok: true, tutar: bakiye.toplam };
}

/** AYLIK OTOMATİK TALEP: komisyoncu "her ayın X'i" seçtiyse o gün bakiyesi
 *  varsa talep kendiliğinden oluşur (admin panelinde görünür). Ay başına TEK
 *  kez: aynı ay içinde talep varsa atlanır. Saatlik tik'ten çağrılır. */
export async function createScheduledPayoutRequests(): Promise<void> {
  const simdi = new Date();
  const gun = simdi.getDate();
  const ayBasi = new Date(simdi.getFullYear(), simdi.getMonth(), 1);

  const agents = await prisma.agent.findMany({
    where: { active: true, payoutDay: gun },
    select: { id: true, iban: true },
  });
  for (const a of agents) {
    const [bekleyen, buAy] = await Promise.all([
      prisma.payoutRequest.count({ where: { agentId: a.id, status: "PENDING" } }),
      prisma.payoutRequest.count({
        where: { agentId: a.id, createdAt: { gte: ayBasi } },
      }),
    ]);
    if (bekleyen > 0 || buAy > 0) continue; // zaten talep var
    const bakiye = await agentBalance(a.id);
    if (bakiye.toplam <= 0) continue;
    await prisma.payoutRequest.create({
      data: {
        agentId: a.id,
        amount: bakiye.toplam,
        iban: a.iban,
        auto: true,
        note: "Aylık otomatik talep",
      },
    });
  }
}
