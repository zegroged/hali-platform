/**
 * MERDİVENE GEÇİŞ HAZIRLIĞI (FIYAT-2026-08-09.md §6) — flip gününde bir kez.
 *
 * NEDEN GEREKLİ: `Subscription.driverSeats` varsayılanı 1. Merdiven bu değerle
 * açılırsa BUGÜN iki şoförü olan işletme "koltuğun 1" diye ikinci şoförünü
 * kaybetmiş gibi görünür ve sert kapı yeni şoför eklemesini engeller. Koltuk
 * sayısı, geçiş anında SAHADAKİ gerçeğe eşitlenmeli.
 *
 * NEDEN OTOMATİK ARTMIYOR: `addDriver` koltuğu KENDİLİĞİNDEN artırmaz — bu
 * bilinçli. Artırsaydı halıcı şoför eklediği an bir sonraki çekimi sessizce
 * 300 TL artardı. Ücret artışı bir SATIŞ kararıdır (paket yükseltme akışı),
 * arka planda olan bir şey değil. Kapı sert, artış açık rızayla.
 *
 * KULLANIM
 *   Kuru çalışma (varsayılan — hiçbir şey yazmaz, ne olacağını gösterir):
 *     npx tsx scripts/merdiven-hazirla.ts
 *   Uygula:
 *     npx tsx scripts/merdiven-hazirla.ts --uygula
 *   Süresiz ücretsizleri VİTRİN'e de taşı (geçiş planının kilit adımı):
 *     npx tsx scripts/merdiven-hazirla.ts --uygula --vitrine-tasi
 *
 * ⚠️ ÖNCE YEDEK. Sunucuda: bash /opt/hali/scripts/backup.sh
 */
import { PrismaClient } from "@prisma/client";
import { SOFOR_TAVANI } from "../src/lib/plan";

const prisma = new PrismaClient();
const UYGULA = process.argv.includes("--uygula");
const VITRINE = process.argv.includes("--vitrine-tasi");

// "Süresiz ücretsiz" işareti: dönem sonu 50 yıldan uzak. Bu kayıtlar admin/
// destek panelinden elle açıldı; gerçek ödeme yapan işletmeyle karışmasınlar.
const SURESIZ_ESIGI = new Date(Date.now() + 50 * 365 * 86400_000);

async function main() {
  console.log(UYGULA ? "KİP: UYGULA (yazar)" : "KİP: KURU ÇALIŞMA (hiçbir şey yazılmaz)");
  console.log(VITRINE ? "VİTRİNE TAŞIMA: AÇIK\n" : "VİTRİNE TAŞIMA: kapalı\n");

  const abonelikler = await prisma.subscription.findMany({
    select: {
      businessId: true,
      status: true,
      currentPeriodEnd: true,
      plan: true,
      driverSeats: true,
      business: { select: { name: true, _count: { select: { drivers: true } } } },
    },
  });

  let koltukDegisen = 0;
  let vitrineDusen = 0;

  for (const s of abonelikler) {
    const soforSayisi = s.business._count.drivers;
    // En az 1 koltuk (şoförü olmayan işletme de taban paketi öder), en çok tavan.
    const hedefKoltuk = Math.min(Math.max(soforSayisi, 1), SOFOR_TAVANI);
    const suresiz =
      s.currentPeriodEnd != null && s.currentPeriodEnd > SURESIZ_ESIGI;
    const hedefPlan = VITRINE && suresiz ? "VITRIN" : s.plan;

    const koltukFark = hedefKoltuk !== s.driverSeats;
    const planFark = hedefPlan !== s.plan;
    if (!koltukFark && !planFark) continue;

    const notlar: string[] = [];
    if (koltukFark) {
      notlar.push(`koltuk ${s.driverSeats} → ${hedefKoltuk} (${soforSayisi} şoför)`);
      koltukDegisen++;
    }
    if (planFark) {
      notlar.push(`plan ${s.plan} → ${hedefPlan} (süresiz ücretsiz)`);
      vitrineDusen++;
    }
    console.log(`  ${s.business.name.padEnd(34).slice(0, 34)} ${notlar.join(" · ")}`);

    if (UYGULA) {
      await prisma.subscription.update({
        where: { businessId: s.businessId },
        data: {
          ...(koltukFark ? { driverSeats: hedefKoltuk } : {}),
          ...(planFark ? { plan: hedefPlan as "VITRIN" } : {}),
        },
      });
    }
  }

  console.log(
    `\nToplam ${abonelikler.length} abonelik · koltuk düzeltilecek: ${koltukDegisen} · VİTRİN'e düşecek: ${vitrineDusen}`,
  );
  if (!UYGULA) console.log("Kuru çalışmaydı. Uygulamak için --uygula ekle.");

  // TAVANI AŞANLAR: 4'ten fazla şoförü olan işletme FİLO'ya geçmeli; koltuk
  // tavanda kalır ama paketi elle FILO yapılmalı (fiyat aynı, ad doğru olsun).
  const filoAdaylari = abonelikler.filter(
    (s) => s.business._count.drivers > SOFOR_TAVANI && s.plan !== "FILO",
  );
  if (filoAdaylari.length) {
    console.log(`\n⚠️ ${SOFOR_TAVANI}+ şoförü olup FİLO olmayan işletmeler (elle bak):`);
    for (const s of filoAdaylari)
      console.log(`  - ${s.business.name} (${s.business._count.drivers} şoför)`);
  }
}

main()
  .catch((e) => {
    console.error("HATA:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
