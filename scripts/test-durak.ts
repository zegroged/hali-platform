/**
 * DURAK TESPİTİ BİRİM TESTİ (2026-08-08).
 *
 * NEDEN VAR: işletme sahibi "9 dakika durdu yazıyor ama çok daha uzun
 * durdum" dedi. Ölçüldü, haklıydı — 5 dk'yı aşan her ping boşluğunda durak
 * kesiliyordu, boşluğun iki ucu AYNI NOKTA olsa bile. Bir günde ~100 dakika
 * gerçek bekleme kaydedilmemişti.
 *
 * Bu sayı halıcının şoförü değerlendirdiği sayı; ekrandan bakarak
 * doğrulanamaz. Kural değiştiğinde bu test tutmalı.
 *
 * Çalıştır: npx tsx scripts/test-durak.ts
 */
import { evaluateStop, STOP_RADIUS_KM, OFFLINE_GAP_SEC, MAX_ABSORB_GAP_SEC, MAX_STOP_SEC } from "../src/lib/tracking";

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

const T0 = new Date("2026-08-08T10:00:00Z");
const dk = (n: number) => new Date(T0.getTime() + n * 60_000);
// ~11 m kuzey (durak çapının İÇİ) ve ~500 m (DIŞI)
const YAKIN = { lat: 37.9501, lng: 32.484 };
const MERKEZ = { lat: 37.95, lng: 32.484 };
const UZAK = { lat: 37.955, lng: 32.484 };

console.log("DURAK TESPİTİ\n");

console.log("A) BOŞLUK + AYNI YER → durak KESİLMEMELİ (2026-08-08 düzeltmesi)");
{
  const s = evaluateStop({
    openStop: { ...MERKEZ, startedAt: dk(0) },
    lastPing: { ...MERKEZ, recordedAt: dk(9) }, // son ping 9. dakikada
    ...YAKIN,
    now: dk(40), // 31 dakikalık boşluktan sonra AYNI yerde
  });
  bekle("uzatılıyor (finalize değil)", s.type === "extend", `gelen: ${s.type}`);
  bekle(
    "süre boşluğu KAPSIYOR (~40 dk)",
    s.type === "extend" && Math.abs(s.durationSec - 40 * 60) < 2,
    s.type === "extend" ? `${Math.round(s.durationSec / 60)} dk` : "",
  );
}

console.log("\nB) BOŞLUK + YER DEĞİŞTİRMİŞ → eski davranış korunmalı");
{
  const s = evaluateStop({
    openStop: { ...MERKEZ, startedAt: dk(0) },
    lastPing: { ...MERKEZ, recordedAt: dk(9) },
    ...UZAK,
    now: dk(40),
  });
  bekle("son ping'de bitiriliyor", s.type === "finalize", `gelen: ${s.type}`);
  bekle(
    "boşluk süreye KATILMIYOR (~9 dk)",
    s.type === "finalize" && Math.abs(s.durationSec - 9 * 60) < 2,
    s.type === "finalize" ? `${Math.round(s.durationSec / 60)} dk` : "",
  );
}

console.log("\nC) BOŞLUK YOK + aynı yer → normal uzatma");
{
  const s = evaluateStop({
    openStop: { ...MERKEZ, startedAt: dk(0) },
    lastPing: { ...MERKEZ, recordedAt: dk(9) },
    ...YAKIN,
    now: dk(10),
  });
  bekle("uzatılıyor", s.type === "extend", `gelen: ${s.type}`);
}

console.log("\nD) Kısa durak + ayrılma → GÜRÜLTÜ, silinmeli");
{
  const s = evaluateStop({
    openStop: { ...MERKEZ, startedAt: dk(0) },
    lastPing: { ...MERKEZ, recordedAt: dk(1) },
    ...UZAK,
    now: dk(2), // 2 dk < 3 dk eşiği
  });
  bekle("siliniyor", s.type === "discard", `gelen: ${s.type}`);
}

console.log("\nE) Açık durak YOK + boşluk + aynı yer → durak AÇILMALI");
{
  const s = evaluateStop({
    openStop: null,
    lastPing: { ...MERKEZ, recordedAt: dk(0) },
    ...YAKIN,
    now: dk(30), // 30 dk donmuş, yerinden kıpırdamamış
  });
  bekle("durak açılıyor", s.type === "open", `gelen: ${s.type}`);
  bekle(
    "başlangıç SON PING anı (boşluğun başı)",
    s.type === "open" && s.startedAt.getTime() === dk(0).getTime(),
  );
}

console.log("\nF) Açık durak YOK + boşluk + yer değişmiş → durak AÇILMAMALI");
{
  const s = evaluateStop({
    openStop: null,
    lastPing: { ...MERKEZ, recordedAt: dk(0) },
    ...UZAK,
    now: dk(30),
  });
  bekle("hiçbir şey yapılmıyor", s.type === "none", `gelen: ${s.type}`);
}

console.log("\nG) Sabitler beklenen değerde (kural sessizce değişmesin)");
bekle("durak çapı 50 m", STOP_RADIUS_KM === 0.05);
bekle("çevrimdışı eşiği 5 dk", OFFLINE_GAP_SEC === 300);


// ── UZUN BOŞLUK YUTULMAZ (2026-08-10, canlıda yaşandı) ───────────────────
// 8 Ağustos'ta açılan durak hiç kapanmadı, durationSec 37 SAATE çıktı: gece
// ve mesai dışı saatler "durakta" sayıldı, sonraki günlerin raporu boşaldı.
console.log("\nUZUN BOŞLUK — aynı yerde olsa bile yutulmaz");
{
  const capa = { lat: 37.9515, lng: 32.4846, startedAt: T0 };
  // 30 dakikalık boşluk + aynı nokta → YUTULUR (2026-08-08 kuralı korunmalı)
  const kisa = evaluateStop({
    openStop: capa,
    lastPing: { recordedAt: dk(30), lat: 37.9515, lng: 32.4846 },
    lat: 37.9515,
    lng: 32.4846,
    now: dk(60),
  });
  bekle("30 dk boşluk + aynı yer → süre uzar", kisa.type === "extend");

  // 12 saatlik boşluk + aynı nokta → BİTİRİLİR (yeni üst sınır)
  const uzun = evaluateStop({
    openStop: capa,
    lastPing: { recordedAt: dk(30), lat: 37.9515, lng: 32.4846 },
    lat: 37.9515,
    lng: 32.4846,
    now: dk(12 * 60),
  });
  bekle(
    "12 saatlik boşluk + aynı yer → durak BİTER (gece yutulmaz)",
    uzun.type === "finalize",
    uzun.type,
  );
  if (uzun.type === "finalize") {
    bekle(
      "biten durak SON PING anıyla kapanır (boşluk süreye girmez)",
      uzun.durationSec === 30 * 60,
      `durationSec=${uzun.durationSec}`,
    );
  }
}
// TAVAN (2026-08-10): boşluk sınırı tek başına yetmiyordu — şoför AKTİF ping
// atarken ve çapadan hiç çıkmazken durak sonsuza kadar büyüyordu. Canlıda 37
// saatlik "durak" böyle oluştu (dükkân bahçesinde park hâlindeki araç) ve
// sonraki günlerin raporu boş çıktı.
console.log("\nDURAK SÜRESİ TAVANI — boşluk olmasa bile");
{
  const capa = { lat: 37.9515, lng: 32.4846, startedAt: T0 };
  const tasan = evaluateStop({
    openStop: capa,
    lastPing: { recordedAt: dk(13 * 60), lat: 37.9515, lng: 32.4846 },
    lat: 37.9515,
    lng: 32.4846,
    now: dk(13 * 60 + 1),
  });
  bekle("13 saatlik durak (boşluk YOK) → kapanır", tasan.type === "finalize", tasan.type);
  if (tasan.type === "finalize")
    bekle("süre tavana kelepçelenir (12 saat)", tasan.durationSec === MAX_STOP_SEC);

  const normal = evaluateStop({
    openStop: capa,
    lastPing: { recordedAt: dk(60), lat: 37.9515, lng: 32.4846 },
    lat: 37.9515,
    lng: 32.4846,
    now: dk(61),
  });
  bekle("1 saatlik durak normal uzamaya devam eder", normal.type === "extend");
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi === 0 ? 0 : 1);
