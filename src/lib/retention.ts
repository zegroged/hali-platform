import { prisma } from "@/lib/prisma";

// Ham konum ping'leri sınırsız büyür (8 sn'de bir × her şoför). Sakla penceresi.
const RETENTION_DAYS = 30;
const PRUNE_INTERVAL_MS = 60 * 60 * 1000; // instance başına en fazla saatte bir
let lastPruneAt = 0;

/**
 * Eski ping'leri temizle. TEK instance için fırsatçı (her konum POST'unda çağrılır,
 * saatte bir gerçekten siler). ÇOK-instance / yüksek hacimde pg_cron veya ayrı bir
 * worker tercih et. Durak (DriverStop) kayıtları aylık rapor için SAKLANIR, silinmez.
 */
export async function maybePrunePings(): Promise<void> {
  const now = Date.now();
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
  lastPruneAt = now;
  const cutoff = new Date(now - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  try {
    await prisma.driverLocationPing.deleteMany({
      where: { recordedAt: { lt: cutoff } },
    });
  } catch (e) {
    console.error("ping retention temizliği hatası:", e);
  }
}
