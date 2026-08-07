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

// ---------------------------------------------------------------------------
// WHATSAPP MEDYASI — 1 AY SAKLAMA (2026-08-07 akşam, işletme sahibinin kararı:
// *"1 ay kâfi ya, dahasına gerek yok"*).
//
// NEDEN SÜRE GEREK: gelen fotoğraf/ses/video artık kendi diskimizde duruyor
// (4.66). Süresiz saklamak hem KVKK'da "gerekli olan süre" ilkesine aykırı
// hem de disk sonsuz değil. 1 ay, hasar/leke tartışmasının çıkacağı pencereyi
// fazlasıyla kapsıyor (sipariş genelde günler içinde kapanıyor).
//
// SATIR SİLİNMEZ, DOSYA SİLİNİR: mesajın kendisi yazışma geçmişinde kalır
// (halıcı "ne konuşmuştuk"u görebilsin), yalnız medya düşer ve gövdeye
// açıklama eklenir — sessizce kaybolup "bozuk mu?" dedirtmesin.
// ---------------------------------------------------------------------------

const WA_MEDYA_GUN = 30;

export async function purgeWhatsAppMedia(): Promise<void> {
  const { unlink } = await import("node:fs/promises");
  const path = await import("node:path");
  const kesim = new Date(Date.now() - WA_MEDYA_GUN * 24 * 60 * 60 * 1000);
  try {
    const eskiler = await prisma.whatsAppMessage.findMany({
      where: { mediaUrl: { not: null }, createdAt: { lt: kesim } },
      select: { id: true, mediaUrl: true, body: true },
      take: 500, // parça parça: tek dev işlem tabloyu kilitlemesin
    });
    for (const m of eskiler) {
      // Yerel diskteki dosya (S3'e geçilirse burada da silinmeli).
      if (m.mediaUrl?.startsWith("/uploads/")) {
        const tam = path.join(process.cwd(), "public", m.mediaUrl.slice(1));
        await unlink(tam).catch(() => {}); // yoksa sorun değil
      }
      await prisma.whatsAppMessage.update({
        where: { id: m.id },
        data: {
          mediaUrl: null,
          mediaType: null,
          mediaId: null, // kimlik de gitsin: Meta'da zaten 30 günde siliniyor
          body: m.body.includes("(dosya süresi doldu)")
            ? m.body
            : `${m.body} (dosya süresi doldu — 1 ay saklanır)`,
        },
      });
    }
    if (eskiler.length) {
      console.log(`[wa-medya] ${eskiler.length} eski dosya silindi (1 ay)`);
    }
  } catch (e) {
    console.error("wa medya temizliği hatası:", e);
  }
}

// ---------------------------------------------------------------------------
// BAŞARISIZ MEDYA İNDİRMESİNİ YENİDEN DENE (2026-08-07 akşam)
//
// NEDEN: indirme mesajın geldiği AN yapılıyor. Tam o saniyede ağ koparsa
// fotoğraf kaybolurdu — oysa Meta dosyayı 30 gün tutuyor. Artık medya kimliği
// satırda saklandığı için (schema `mediaId`) saatlik tik yeniden deniyor.
// ---------------------------------------------------------------------------

export async function retryWhatsAppMedia(): Promise<void> {
  const kesim = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000); // Meta 30 gün
  try {
    const eksikler = await prisma.whatsAppMessage.findMany({
      where: { mediaId: { not: null }, mediaUrl: null, createdAt: { gt: kesim } },
      select: { id: true, mediaId: true },
      take: 20, // tur başına az: her deneme Meta'ya istek demek
    });
    if (!eksikler.length) return;
    const { waMedyayiIndir } = await import("@/lib/whatsappMedya");
    let basarili = 0;
    for (const m of eksikler) {
      const medya = await waMedyayiIndir(m.mediaId!);
      if (!medya) continue;
      await prisma.whatsAppMessage.update({
        where: { id: m.id },
        data: { mediaUrl: medya.url, mediaType: medya.tur },
      });
      basarili++;
    }
    console.log(
      `[wa-medya] yeniden deneme: ${eksikler.length} eksik, ${basarili} kurtarıldı`,
    );
  } catch (e) {
    console.error("wa medya yeniden deneme hatası:", e);
  }
}
