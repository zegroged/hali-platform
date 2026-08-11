/**
 * HAFTALIK HALI NUMARASI BİRİM TESTİ (2026-08-10).
 *
 * NEDEN VAR: işletme sahibi "halılara numara otomatik verilsin 1 2 3 4 5 diye
 * gitsin, her haftada yenilensin" dedi. Saf sıfırlama dükkânda BEKLEYEN halıyla
 * çakışır: yıkama uzarsa aynı anda iki tane "3" olur ve numaranın tek işi
 * (halıyı bulmak) tam da en çok gerektiği anda bozulur.
 *
 * Bu kural ekrandan bakarak doğrulanamaz — çakışma ancak eski bir halı
 * dükkânda beklerken YENİ hafta başlayınca ortaya çıkar. Kural değişirse
 * bu test tutmalı.
 *
 * Çalıştır: npx tsx scripts/test-halino.ts
 */
import { sonrakiIlkNo, haliNolari, haliEtiketi } from "../src/lib/haliNo";
import { trWeekStartUTC } from "../src/lib/time";

let gecti = 0;
let kaldi = 0;

function bekle(ad: string, kosul: boolean, ek = "") {
  if (kosul) {
    gecti++;
    console.log(`  ✓ ${ad}`);
  } else {
    kaldi++;
    console.log(`  ✗ ${ad}${ek ? " — " + ek : ""}`);
  }
}

const bos = new Set<number>();

console.log("HAFTALIK HALI NUMARASI\n");

console.log("A) TEMİZ HAFTA → 1'den başlar");
{
  bekle("boş dükkân, tek halı → 1", sonrakiIlkNo(1, bos, 0) === 1);
  bekle("boş dükkân, 3 halı → 1 (1-2-3)", sonrakiIlkNo(3, bos, 0) === 1);
  bekle(
    "3 halı alındıktan sonra sıradaki → 4",
    sonrakiIlkNo(1, new Set([1, 2, 3]), 3) === 4,
  );
}

console.log("\nB) HAFTA SIFIRLANDI, DÜKKÂN BOŞ → yine 1");
{
  // Geçen haftanın halıları teslim edildi: `dolu` boş, `buHaftaEnBuyuk` 0.
  bekle("yeni hafta, hiçbiri beklemiyor → 1", sonrakiIlkNo(1, bos, 0) === 1);
}

console.log("\nC) 🔴 HAFTA SIFIRLANDI AMA ESKİ HALI DÜKKÂNDA → ATLAR");
{
  // Geçen haftadan 3 numaralı halı hâlâ yıkanıyor.
  const dolu = new Set([3]);
  bekle("1 boş → 1 verilir", sonrakiIlkNo(1, dolu, 0) === 1);
  bekle("1-2 dağıtıldı, sıradaki 3 DOLU → 4 verilir", sonrakiIlkNo(1, dolu, 2) === 4);
  bekle(
    "iki canlı '3' ASLA olmaz",
    sonrakiIlkNo(1, dolu, 2) !== 3,
    "çakışma: aynı anda iki halı 3 numaralı",
  );
}

console.log("\nD) ÇOK HALILI SİPARİŞ ARALIĞA SIĞMALI");
{
  // 2 ve 5 dolu; 3 halılık sipariş 2-3-4'e SIĞMAZ (2 dolu), 3-4-5'e de sığmaz.
  const dolu = new Set([2, 5]);
  const n = sonrakiIlkNo(3, dolu, 0);
  const alinan = haliNolari(n, 3);
  bekle(
    `3 halı ${alinan.join("-")} → hiçbiri dolu değil`,
    alinan.every((x) => !dolu.has(x)),
    `çakıştı: ${alinan.filter((x) => dolu.has(x)).join(",")}`,
  );
  bekle("aralık ardışık", alinan[1] === alinan[0] + 1 && alinan[2] === alinan[1] + 1);
  bekle("en küçük uygun aralık seçildi (6-7-8)", n === 6, `gelen: ${n}`);
}

console.log("\nE) HAFTA BAŞI PAZARTESİ (TR)");
{
  // 2026-08-10 Pazartesi. Hafta başı kendisi olmalı (TR 00:00 = UTC 21:00 pazar).
  const pzt = trWeekStartUTC(new Date("2026-08-12T09:00:00Z")); // çarşamba
  bekle(
    "çarşamba → o haftanın pazartesisi",
    pzt.toISOString() === "2026-08-09T21:00:00.000Z",
    pzt.toISOString(),
  );
  // 🔴 PAZAR TUZAĞI: getUTCDay() pazar için 0 döner; naif kod 1 gün geri gider
  // ve haftayı BİR GÜN ERKEN kapatır (pazar günü alınan halı yeni haftaya düşer).
  const pazar = trWeekStartUTC(new Date("2026-08-16T09:00:00Z")); // pazar
  bekle(
    "pazar → AYNI haftanın pazartesisi (10 Ağustos)",
    pazar.toISOString() === "2026-08-09T21:00:00.000Z",
    pazar.toISOString(),
  );
  // Pazartesi TR 00:30 → hafta o gün başlar, bir önceki haftaya düşmez.
  const gece = trWeekStartUTC(new Date("2026-08-09T21:30:00Z")); // TR pzt 00:30
  bekle(
    "pazartesi gece yarısından sonra → o hafta",
    gece.toISOString() === "2026-08-09T21:00:00.000Z",
    gece.toISOString(),
  );
}

console.log("\nF) ETİKET");
{
  bekle("base varsa dükkân numarası", haliEtiketi(12, 1) === "No 12");
  bekle("base varsa ikinci halı", haliEtiketi(12, 3) === "No 14");
  bekle("base yoksa sipariş içi sıra", haliEtiketi(null, 2) === "Halı 2");
}

console.log("\nG) SINIR DURUMLARI");
{
  bekle("adet 0 → tek halı gibi davranır", sonrakiIlkNo(0, bos, 0) === 1);
  bekle("base null → numara listesi boş", haliNolari(null, 3).length === 0);
  bekle("numaralar base'ten başlar", haliNolari(7, 3).join(",") === "7,8,9");
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi > 0 ? 1 : 0);
