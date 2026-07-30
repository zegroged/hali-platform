import { prisma } from "@/lib/prisma";

// Ham konum ping'leri sınırsız büyür (8 sn'de bir × her şoför). Sakla penceresi.
const RETENTION_DAYS = 30;
const PRUNE_INTERVAL_MS = 60 * 60 * 1000; // instance başına en fazla saatte bir
let lastPruneAt = 0;

/**
 * Eski ping'leri temizle. TEK instance için fırsatçı (her konum POST'unda çağrılır,
 * saatte bir gerçekten siler). ÇOK-instance / yüksek hacimde pg_cron veya ayrı bir
 * worker tercih et. Duraklar (DriverStop) aylık rapor için burada SAKLANIR;
 * 12 aylık KVKK tavanı aşağıdaki purgeRetention'da uygulanır.
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

// ---------------------------------------------------------------------------
// KVKK 12 AY SAKLAMA TAVANI (durak kayıtları dahil)
// Gizlilik politikası (/gizlilik) ve şoför aydınlatması (/kvkk) "teslimat
// duraklarına ilişkin özet kayıtlar 12 ay saklanır, sonunda silinir" diye
// TAAHHÜT ediyor. Yukarıdaki fırsatçı temizlik yalnız ham ping'leri ve yalnız
// konum POST'u geldiğinde siliyordu — durak kaydına hiç dokunmuyordu, yani
// taahhüdün durak kısmının kod karşılığı YOKTU. Bu iş onu kapatır; günde bir
// kez instrumentation.ts'ten çağrılır (zamanlayıcı orada, gövde burada).
// ---------------------------------------------------------------------------

const STOP_RETENTION_DAYS = 365; // 12 ay
// Parça parça sil: startedAt/recordedAt indeksli değil, tek dev DELETE tabloyu
// uzun süre kilitler ve şoför uygulaması konum yazarken bekler.
const BATCH = 5_000;
// Günlük tavan (BATCH × tur): birikmiş devasa tabloyu tek seferde silmeye
// çalışıp veritabanını yormasın, kalanı ertesi gün alınır.
const MAX_BATCHES = 20;

async function purgeBatched(
  bul: (take: number) => Promise<{ id: string }[]>,
  sil: (ids: string[]) => Promise<number>,
): Promise<number> {
  let toplam = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const eski = await bul(BATCH);
    if (eski.length === 0) break;
    toplam += await sil(eski.map((r) => r.id));
    if (eski.length < BATCH) break;
  }
  return toplam;
}

/**
 * 12 aydan eski durak ve konum kayıtlarını siler (KVKK taahhüdü).
 * Hata FIRLATMAZ — çağıran açılış/zamanlayıcı akışı bunun yüzünden durmamalı.
 */
export async function purgeExpiredLocationData(): Promise<{
  stops: number;
  pings: number;
}> {
  const cutoff = new Date(Date.now() - STOP_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  let stops = 0;
  let pings = 0;
  try {
    // startedAt = durağın başlangıcı; 12 aylık sayaç oradan işler.
    stops = await purgeBatched(
      (take) =>
        prisma.driverStop.findMany({
          where: { startedAt: { lt: cutoff } },
          select: { id: true },
          take,
        }),
      async (ids) =>
        (await prisma.driverStop.deleteMany({ where: { id: { in: ids } } }))
          .count,
    );
    // Ping'ler normalde 30 günde temizlenir; bu tur, konum POST'u hiç gelmediği
    // için fırsatçı temizliğin çalışmadığı dönemlerde tavanı yine de uygular.
    pings = await purgeBatched(
      (take) =>
        prisma.driverLocationPing.findMany({
          where: { recordedAt: { lt: cutoff } },
          select: { id: true },
          take,
        }),
      async (ids) =>
        (
          await prisma.driverLocationPing.deleteMany({
            where: { id: { in: ids } },
          })
        ).count,
    );
    if (stops > 0 || pings > 0) {
      // Konteynerde TZ yok (UTC): sınır tarihi TR saatiyle yazılmazsa log 3 saat geri okunur.
      const sinir = cutoff.toLocaleString("tr-TR", {
        timeZone: "Europe/Istanbul",
      });
      console.log(
        `[saklama-temizligi] ${stops} durak + ${pings} konum izi silindi (${sinir} öncesi)`,
      );
    }
  } catch (e) {
    console.error("[saklama-temizligi] hata:", e);
  }
  return { stops, pings };
}
