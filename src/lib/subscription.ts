// Abonelik durumu — halıcı sipariş alabilir mi / keşifte görünür mü.
// Gelir modeli: 2000 TL/ay. Onayda 30 gün TRIAL verilir; sonra ACTIVE olmalı.

export const TRIAL_DAYS = 30;

type SubLike = { status: string; currentPeriodEnd: Date | null } | null | undefined;

/** ACTIVE, veya TRIAL süresi DOLMAMIŞ ise sipariş alabilir. PAST_DUE/CANCELED/süresi geçmiş TRIAL: hayır. */
export function subscriptionActive(sub: SubLike): boolean {
  if (!sub) return false;
  if (sub.status === "ACTIVE") return true;
  if (sub.status === "TRIAL") {
    return sub.currentPeriodEnd != null && sub.currentPeriodEnd.getTime() > Date.now();
  }
  return false;
}

/** Prisma where filtresi: keşifte yalnız aktif/geçerli-trial abonelikli işletmeler. */
export function activeSubscriptionWhere() {
  return {
    OR: [
      { status: "ACTIVE" as const },
      { status: "TRIAL" as const, currentPeriodEnd: { gt: new Date() } },
    ],
  };
}
