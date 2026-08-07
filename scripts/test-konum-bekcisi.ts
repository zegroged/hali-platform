/**
 * Konum bekçisi KURU ÇALIŞTIRMA — kime uyarı gideceğini bildirim GÖNDERMEDEN
 * gösterir. Bekçiyle aynı eşikleri kullanır; eşik değişirse burası da değişmeli.
 *
 * Kullanım (sunucuda, konteyner içinde):
 *   npx tsx scripts/test-konum-bekcisi.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SESSIZLIK_DK = 10;
const TERK_DK = 12 * 60;

function tr(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d.getTime() + 3 * 3600_000).toISOString().slice(5, 16).replace("T", " ");
}

async function main() {
  const hepsi = await prisma.driver.findMany({
    where: { isOnShift: true },
    select: {
      id: true,
      shiftStartedAt: true,
      user: { select: { name: true, username: true } },
      business: { select: { name: true, ownerId: true } },
    },
  });

  const pingler = await prisma.driverLocationPing.groupBy({
    by: ["driverId"],
    where: { driverId: { in: hepsi.map((s) => s.id) } },
    _max: { recordedAt: true },
  });
  const sonPing = new Map(
    pingler.map((p) => [p.driverId, p._max.recordedAt?.getTime() ?? 0]),
  );

  const simdi = Date.now();
  console.log(`Şu an (TR): ${tr(new Date(simdi))}`);
  console.log(`Mesaide görünen şoför: ${hepsi.length}\n`);

  for (const s of hepsi) {
    const ad = s.user.username ?? s.user.name ?? "?";
    if (!s.shiftStartedAt) {
      console.log(`  ${ad.padEnd(22)} ATLANDI — mesai damgası yok (eski mesai)`);
      continue;
    }
    const referans = Math.max(sonPing.get(s.id) ?? 0, s.shiftStartedAt.getTime());
    const sessizDk = Math.floor((simdi - referans) / 60_000);
    let karar: string;
    if (sessizDk > TERK_DK) karar = `ATLANDI — terk edilmiş (${Math.floor(sessizDk / 60)}sa)`;
    else if (sessizDk < SESSIZLIK_DK) karar = "SAĞLIKLI";
    else karar = `🔔 UYARI → şoför + ${s.business.name} sahibi`;
    console.log(
      `  ${ad.padEnd(22)} mesai:${tr(s.shiftStartedAt)} sonPing:${tr(sonPing.get(s.id) ? new Date(sonPing.get(s.id)!) : null)} sessiz:${sessizDk}dk  ${karar}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
