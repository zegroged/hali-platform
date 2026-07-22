// Sunucu açılışında bir kez çalışır (Next.js instrumentation hook).
// KVKK saklama süresi temizliği: gizlilik politikası ve şoför aydınlatması
// 12 ayı aşan konum kayıtlarının silineceğini taahhüt eder — burada uygulanır.

const RETENTION_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

async function purgeOldLocationData() {
  // prisma'yı burada import et: instrumentation edge bundle'ına sızmasın.
  const { prisma } = await import("@/lib/prisma");
  const cutoff = new Date(Date.now() - RETENTION_DAYS * DAY_MS);
  try {
    const pings = await prisma.driverLocationPing.deleteMany({
      where: { recordedAt: { lt: cutoff } },
    });
    const stops = await prisma.driverStop.deleteMany({
      where: { startedAt: { lt: cutoff } },
    });
    if (pings.count > 0 || stops.count > 0) {
      console.log(
        `[saklama-temizligi] ${pings.count} konum izi + ${stops.count} durak silindi (>${RETENTION_DAYS} gün)`,
      );
    }
  } catch (e) {
    console.error("[saklama-temizligi] hata:", e);
  }
}

async function hourlyTick() {
  try {
    const { maybeSendWeeklyDigest } = await import("@/lib/weeklyDigest");
    await maybeSendWeeklyDigest();
  } catch (e) {
    console.error("[haftalik-ozet] hata:", e);
  }
  try {
    const { checkStaleOrders } = await import("@/lib/orderSla");
    await checkStaleOrders();
  } catch (e) {
    console.error("[siparis-sla] hata:", e);
  }
  try {
    const { backfillMissingCommissions } = await import("@/lib/commission");
    await backfillMissingCommissions();
  } catch (e) {
    console.error("[komisyon-backfill] hata:", e);
  }
}

export async function register() {
  // Yalnız Node.js runtime'ında (edge/middleware derlemesinde prisma yok).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Açılışta bir kez + günde bir. unref: interval, kapanışı bloklamasın.
  await purgeOldLocationData();
  const timer = setInterval(purgeOldLocationData, DAY_MS);
  if (typeof timer.unref === "function") timer.unref();
  // Saatlik tik: haftalık özet (yalnız TR pazartesi, AppState işaretli) +
  // sipariş SLA bekçisi (2s hatırlatma / 24s eskalasyon; sipariş başına bir kez).
  // await ETME: birikmiş iş (e-posta döngüsü) açılışı bloklamasın — kesinti
  // sonrası site bir an önce ayağa kalkmalı.
  void hourlyTick();
  const hourlyTimer = setInterval(hourlyTick, 60 * 60 * 1000);
  // Açılışta da bir kez (30 sn sonra): deploy sonrası SLA/komisyon-backfill
  // taraması bir saat beklemesin.
  setTimeout(hourlyTick, 30_000);
  if (typeof hourlyTimer.unref === "function") hourlyTimer.unref();
}
