// Abonelik durumu — halıcı sipariş alabilir mi / keşifte görünür mü.
// Gelir modeli (2026-07-07): 2.000 TL + KDV/ay, PEŞİN; ücretsiz deneme YOK.
// Ödeme alınınca admin (ileride iyzico callback'i) 1 aylık ACTIVE dönem açar;
// dönem uzatılmazsa süre bitiminde işletme otomatik yayından düşer.
// (TRIAL dalı yalnız eski kayıtların geriye uyumu için duruyor.)

export const PERIOD_DAYS = 30;

type SubLike = { status: string; currentPeriodEnd: Date | null } | null | undefined;

/** Dönemi DOLMAMIŞ ACTIVE (veya eski TRIAL) ise sipariş alabilir. */
export function subscriptionActive(sub: SubLike): boolean {
  if (!sub) return false;
  if (sub.status === "ACTIVE" || sub.status === "TRIAL") {
    return sub.currentPeriodEnd != null && sub.currentPeriodEnd.getTime() > Date.now();
  }
  return false;
}

/** Prisma where filtresi: keşifte yalnız dönemi geçerli abonelikli işletmeler. */
export function activeSubscriptionWhere() {
  return {
    OR: [
      { status: "ACTIVE" as const, currentPeriodEnd: { gt: new Date() } },
      { status: "TRIAL" as const, currentPeriodEnd: { gt: new Date() } },
    ],
  };
}
