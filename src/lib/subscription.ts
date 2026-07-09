// Abonelik durumu — halıcı sipariş alabilir mi / keşifte görünür mü.
// Gelir modeli (2026-07-07): 2.000 TL + KDV/ay, PEŞİN; ücretsiz deneme YOK.
// Ödeme alınınca admin (ileride iyzico callback'i) 1 aylık ACTIVE dönem açar;
// dönem uzatılmazsa süre bitiminde işletme otomatik yayından düşer.
// (TRIAL dalı yalnız eski kayıtların geriye uyumu için duruyor.)

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma, type PrismaClient } from "@prisma/client";

export const PERIOD_DAYS = 30;

type SubLike = { status: string; currentPeriodEnd: Date | null } | null | undefined;
// prisma VEYA $transaction içindeki tx istemcisi — ikisi de $queryRaw taşır.
type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Aboneliği 1 dönem (30 gün) uzat/başlat — ödeme alınınca (iyzico callback'i
 * veya admin havale butonu) çağrılır. Dönem hâlâ geçerliyse ÜSTÜNE ekler
 * (ardışık ödemeler birikir). Yeni dönem SONUNU döndürür.
 *
 * ATOMİK (2026-07-09): tek SQL upsert + GREATEST + satır kilidi ile eşzamanlı
 * iki ödemenin dönemi tek 30 güne çökmesini engeller (read-modify-write yarışı
 * yok). `db` ile transaction istemcisi geçilebilir (callback atomikliği için).
 */
export async function extendSubscription(
  db: Db,
  businessId: string,
): Promise<Date> {
  const id = "sub_" + crypto.randomBytes(12).toString("hex"); // yalnız INSERT dalında kullanılır
  const rows = await db.$queryRaw<{ endsAt: Date }[]>(Prisma.sql`
    INSERT INTO "Subscription"
      (id, "businessId", status, "priceMonthly", "currentPeriodStart", "currentPeriodEnd", "createdAt", "updatedAt")
    VALUES
      (${id}, ${businessId}, 'ACTIVE'::"SubscriptionStatus", 2000, now(), now() + interval '30 days', now(), now())
    ON CONFLICT ("businessId") DO UPDATE SET
      status = 'ACTIVE'::"SubscriptionStatus",
      -- Dönem hâlâ geçerliyse üstüne ekle, dolduysa şimdiden başlat (atomik birikim).
      "currentPeriodEnd" = GREATEST(now(), "Subscription"."currentPeriodEnd") + interval '30 days',
      "updatedAt" = now()
    RETURNING "currentPeriodEnd" AS "endsAt"
  `);
  return rows[0].endsAt;
}

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
