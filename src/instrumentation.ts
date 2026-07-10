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

export async function register() {
  // Yalnız Node.js runtime'ında (edge/middleware derlemesinde prisma yok).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Açılışta bir kez + günde bir. unref: interval, kapanışı bloklamasın.
  await purgeOldLocationData();
  const timer = setInterval(purgeOldLocationData, DAY_MS);
  if (typeof timer.unref === "function") timer.unref();
}
