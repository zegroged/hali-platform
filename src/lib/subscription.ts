// Abonelik durumu — halıcı sipariş alabilir mi / keşifte görünür mü.
// Gelir modeli (2026-07-07): 2.000 TL + KDV/ay, PEŞİN; ücretsiz deneme YOK.
// Ödeme alınınca admin (ileride iyzico callback'i) 1 aylık ACTIVE dönem açar;
// dönem uzatılmazsa süre bitiminde işletme otomatik yayından düşer.
// (TRIAL dalı yalnız eski kayıtların geriye uyumu için duruyor.)

import crypto from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { merdivenAktif } from "@/lib/config";

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
  months = 1,
): Promise<Date> {
  // ÇOK AYLIK DÖNEM (2026-08-09). Eskiden bu fonksiyon her çağrıda SABİT 1 ay
  // ekliyor ve ödenen tutara hiç bakmıyordu. Sezonluk peşin (9 ay) bu yüzden
  // İMKÂNSIZDI: 8.100 TL alınıp 1 ay açılırdı, halıcı 8 ayın parasını ödemiş
  // ama hizmet almıyor olurdu (denetim bulgusu). Ay sayısı artık çağıranın
  // sorumluluğunda ve `SubscriptionPayment.periodMonths` ile birlikte yazılır.
  const ay = Math.min(Math.max(Math.trunc(Number(months) || 1), 1), 24);
  const id = "sub_" + crypto.randomBytes(12).toString("hex"); // yalnız INSERT dalında kullanılır
  const rows = await db.$queryRaw<{ endsAt: Date }[]>(Prisma.sql`
    INSERT INTO "Subscription"
      (id, "businessId", status, "priceMonthly", "currentPeriodStart", "currentPeriodEnd", "createdAt", "updatedAt")
    VALUES
      (${id}, ${businessId}, 'ACTIVE'::"SubscriptionStatus", 2000, now(), now() + interval '1 month' * ${ay}::int + interval '3 days', now(), now())
    ON CONFLICT ("businessId") DO UPDATE SET
      status = 'ACTIVE'::"SubscriptionStatus",
      -- Dönem hâlâ geçerliyse üstüne ekle, dolduysa şimdiden başlat (atomik birikim).
      -- TAKVİM AYI + 3 GÜN PAY (2026-07-28 denetim).
      -- Eskiden sabit '30 days' eklenirdi; iyzico ise TAKVİM AYINDA çeker
      -- (plan MONTHLY). 31 günlük aylarda dönem çekimden 1 gün ÖNCE bitiyor,
      -- parasını düzenli ödeyen halıcı o gün keşiften düşüyor ve sipariş
      -- API'si 410 veriyordu — yılda ~7 gün "ödedim ama yokum". Takvim ayına
      -- geçildi; 3 gün pay ise çekimin banka/iyzico tarafında birkaç saat
      -- gecikmesine karşı emniyet payı (fazladan gün bedava, eksik gün pahalı).
      "currentPeriodEnd" = GREATEST(now(), "Subscription"."currentPeriodEnd") + interval '1 month' * ${ay}::int + interval '3 days',
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

/**
 * KEŞİF GÖRÜNÜRLÜK FİLTRESİ — merdiven modelinin görünürlük kuralı.
 *
 * Bugünkü model (merdiven KAPALI): ödeme yayın şartıdır, sözleşme §3/§4 böyle
 * diyor → `activeSubscriptionWhere()` aynen uygulanır.
 *
 * Merdiven AÇIKKEN: VİTRİN kalıcı ücretsizdir ve LİSTELENME VİTRİN'e dahildir.
 * Yani ödemesi biten işletme keşiften KAYBOLMAZ, ücretli modülleri kapanır.
 * Bu ayrım kritik: 1 Eylül bildiriminde işletmelere "profilin, listelenmen ve
 * yorumların hiç kapanmayacak" diye YAZILI söz verilecek. Filtre değişmezse o
 * söz bugünkü kodla tutulamaz (denetim bulgusu) — ödemeyen işletmeler ertesi
 * gün il/ilçe sayfalarından silinirdi.
 *
 * Yayından düşürmenin yolu abonelik DEĞİLDİR, ayrı mekanizmalar korunur:
 * REJECTED (kill switch), tatil modu (`pausedUntil`) ve profil eksikliği.
 */
export function gorunurlukWhere() {
  if (!merdivenAktif) return activeSubscriptionWhere();
  return {
    OR: [
      { status: "ACTIVE" as const, currentPeriodEnd: { gt: new Date() } },
      { status: "TRIAL" as const, currentPeriodEnd: { gt: new Date() } },
      // Dönemi bitmiş/iptal olmuş herkes VİTRİN'dir ve vitrin listelenir.
      { status: "ACTIVE" as const, currentPeriodEnd: { lte: new Date() } },
      { status: "CANCELED" as const },
      { status: "PAST_DUE" as const },
      { status: "TRIAL" as const, currentPeriodEnd: { lte: new Date() } },
    ],
  };
}
