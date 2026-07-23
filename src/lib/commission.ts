import { prisma } from "@/lib/prisma";
import { PLAN } from "@/lib/plan";

// KOMİSYON TAHAKKUKU: komisyoncunun getirdiği işletmenin HER başarılı abonelik
// ödemesinde (ilk ödeme + aylık yenileme) KDV HARİÇ net tutar üzerinden,
// admin'in hesap açarken belirlediği yüzdeyle tahakkuk işlenir.
// İDEMPOTENT: CommissionEntry.paymentId @unique — aynı ödemeye ikinci tahakkuk
// yazılamaz (çift callback/webhook replay'inde P2002 → sessiz no-op).
// Best-effort çağrılır: hata ödeme kaydını ASLA geriye döndürmez.

const kurus = (n: number) => Math.round(n * 100) / 100;

export async function accrueCommissionForPayment(paymentId: string): Promise<void> {
  try {
    const payment = await prisma.subscriptionPayment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        status: true,
        amount: true,
        businessId: true,
        business: {
          select: {
            referredByAgentId: true,
            referredByAgent: {
              select: { id: true, active: true, percent: true },
            },
          },
        },
      },
    });
    if (!payment || payment.status !== "PAID") return;
    const agent = payment.business.referredByAgent;
    // Pasif komisyoncuya YENİ tahakkuk işlenmez (eski tahakkukları durur).
    if (!agent || !agent.active) return;

    const gross = Number(payment.amount);
    if (!Number.isFinite(gross) || gross <= 0) return;
    // KDV hariç matrah: 2.400 / 1,20 = 2.000 (PLAN.kdvRate tek kaynak).
    const net = kurus(gross / (1 + PLAN.kdvRate / 100));
    const percent = Number(agent.percent);
    if (!Number.isFinite(percent) || percent <= 0) return;
    const tutar = kurus((net * percent) / 100);
    if (tutar <= 0) return;

    await prisma.commissionEntry.create({
      data: {
        agentId: agent.id,
        businessId: payment.businessId,
        paymentId: payment.id,
        grossAmount: gross,
        netAmount: net,
        percent,
        amount: tutar,
      },
    });
  } catch (e) {
    // P2002 = bu ödemeye tahakkuk zaten işlendi (çift callback) → normal no-op.
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      return;
    }
    console.error("komisyon tahakkuku:", e);
  }
}


/** GÜVENLİK AĞI: komisyoncusu olan işletmelerin son 90 gündeki PAID ödemeleri
 *  içinde tahakkuku EKSİK kalanları tarar ve işler (accrue geçici bir hatayla
 *  yutulmuşsa komisyon kaybolmasın). Saatlik tik'ten çağrılır; idempotent. */
export async function backfillMissingCommissions(): Promise<void> {
  try {
    const eksikler = await prisma.subscriptionPayment.findMany({
      where: {
        status: "PAID",
        // 0 TL'lik ücretsiz-dönem kayıtları hariç: tahakkuk üretmezler ama
        // "commission: null" kaldıkları için take:50 penceresini tıkarlardı.
        amount: { gt: 0 },
        paidAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        commission: null,
        business: { referredByAgentId: { not: null } },
      },
      select: { id: true },
      take: 50,
    });
    for (const p of eksikler) await accrueCommissionForPayment(p.id);
  } catch (e) {
    console.error("komisyon-backfill:", e);
  }
}
