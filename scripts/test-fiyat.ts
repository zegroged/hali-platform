/**
 * FİYAT MERDİVENİ BİRİM TESTİ (2026-08-09).
 *
 * NEDEN VAR: bu sayılar KARTTAN ÇEKİLEN paradır. Ekrana bakarak doğrulanamaz,
 * yanlışsa ancak müşterinin kartından yanlış tutar çekilince anlaşılır — ve o
 * noktada geri dönüşü chargeback'tir. Merdiven değiştiğinde bu test tutmalı.
 *
 * EN ÖNEMLİ DEĞİŞMEZ (en altta): kodun üretebileceği HER tutarın iyzico'da
 * açılmış bir planı olmalı. Karşılığı olmayan bir tutar üretirsek düzenli ödeme
 * talimatı hiç açılmaz ve halıcı sebebini anlamadan her ay elle öder.
 *
 * Çalıştır: npx tsx scripts/test-fiyat.ts
 */
process.env.DATABASE_URL ??= "postgresql://x:x@localhost:5432/x"; // sorgu yok, yalnız import

import {
  fiyatBasamagi,
  merdiven,
  tahsilEdilecekBrut,
  SOFOR_TAVANI,
  PLAN_TUTARLARI,
  PLAN,
} from "../src/lib/plan";
import { getIyzicoPlanRefByGross } from "../src/lib/config";

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

console.log("\nLİSTE MERDİVENİ (KDV dahil)");
bekle("1 şoför → 900", fiyatBasamagi("YONETIM", 1).brut === 900);
bekle("2 şoför → 1.200", fiyatBasamagi("YONETIM", 2).brut === 1200);
bekle("3 şoför → 1.500", fiyatBasamagi("YONETIM", 3).brut === 1500);
bekle("4 şoför → 1.800", fiyatBasamagi("YONETIM", 4).brut === 1800);

console.log("\nTAVAN — 4. şoförden sonrası ücretsiz (sınırsız)");
for (const n of [5, 7, 12, 99]) {
  const b = fiyatBasamagi("YONETIM", n);
  bekle(`${n} şoför → 1.800 ve sınırsız`, b.brut === 1800 && b.sinirsiz, `brut=${b.brut}`);
}
bekle(
  "tavan sabiti merdiven uzunluğuyla aynı",
  SOFOR_TAVANI === merdiven().length,
);

console.log("\nKURUCU — listeden BİR BASAMAK aşağı");
bekle("kurucu 1 şoför → 600", fiyatBasamagi("YONETIM", 1, true).brut === 600);
bekle("kurucu 2 şoför → 900", fiyatBasamagi("YONETIM", 2, true).brut === 900);
bekle("kurucu 3 şoför → 1.200", fiyatBasamagi("YONETIM", 3, true).brut === 1200);
bekle("kurucu 4+ şoför → 1.500", fiyatBasamagi("YONETIM", 9, true).brut === 1500);
// Kararın tanımı buydu: "kurucu + 2 şoför" ile "liste + 1 şoför" AYNI parayı öder.
// iyzico'da paket başına değil FİYAT başına plan olmasının sebebi de bu.
for (let n = 1; n < SOFOR_TAVANI; n++) {
  bekle(
    `kurucu ${n + 1} şoför = liste ${n} şoför`,
    fiyatBasamagi("YONETIM", n + 1, true).brut === fiyatBasamagi("YONETIM", n).brut,
  );
}

console.log("\nVİTRİN — her koşulda 0");
for (const n of [0, 1, 5, 40]) {
  const b = fiyatBasamagi("VITRIN", n, n % 2 === 0);
  bekle(`vitrin ${n} şoför → 0`, b.brut === 0 && b.net === 0 && b.kdv === 0);
}

console.log("\nFİLO — şoför sayısına bakmadan tavandan faturalanır");
bekle("filo 1 şoför → 1.800", fiyatBasamagi("FILO", 1).brut === 1800);
bekle("filo 50 şoför → 1.800", fiyatBasamagi("FILO", 50).brut === 1800);
bekle("kurucu filo → 1.500", fiyatBasamagi("FILO", 1, true).brut === 1500);

console.log("\nKDV MATEMATİĞİ (%20)");
bekle("kdv oranı 20", PLAN.kdvRate === 20);
for (const [paket, n, kurucu] of [
  ["YONETIM", 1, false],
  ["YONETIM", 3, false],
  ["YONETIM", 1, true],
  ["FILO", 1, false],
] as const) {
  const b = fiyatBasamagi(paket, n, kurucu);
  bekle(
    `${b.brut} = net ${b.net} + kdv ${b.kdv}`,
    Math.abs(b.net + b.kdv - b.brut) < 0.005,
  );
  bekle(
    `${b.brut} brütün matrahı ${b.brut / 1.2}`,
    Math.abs(b.net - b.brut / 1.2) < 0.005,
    `net=${b.net}`,
  );
}

console.log("\nKİRLİ GİRDİ — en az 1 koltuk faturalanır");
for (const n of [0, -3, Number.NaN, 0.4, 1.9]) {
  const b = fiyatBasamagi("YONETIM", n as number);
  bekle(
    `şoför=${String(n)} → geçerli basamak`,
    b.koltuk >= 1 && b.koltuk <= SOFOR_TAVANI && b.brut > 0,
    `koltuk=${b.koltuk} brut=${b.brut}`,
  );
}

console.log("\n🔑 DEĞİŞMEZ: üretilen her tutarın iyzico'da planı olmalı");
const uretilenler = new Set<number>();
for (const paket of ["YONETIM", "FILO"] as const) {
  for (const kurucu of [false, true]) {
    for (let n = 1; n <= SOFOR_TAVANI + 3; n++) {
      uretilenler.add(fiyatBasamagi(paket, n, kurucu).brut);
    }
  }
}
const planli = new Set<number>(PLAN_TUTARLARI);
for (const t of [...uretilenler].sort((a, b) => a - b)) {
  bekle(`${t} TL için plan tanımlı`, planli.has(t));
}
// Ters yön: iyzico'da açık ama kodun asla üretmediği bir tutar varsa bu bir
// hata değildir (eski plan duruyor olabilir) ama BİLİNMELİ.
const kullanilmayan = [...planli].filter((t) => !uretilenler.has(t));
if (kullanilmayan.length) {
  console.log(`  ℹ️ kod bu tutarları üretmiyor (plan boşta): ${kullanilmayan.join(", ")}`);
}

console.log("\nSONSUZ ŞOFÖR → TAVAN (tabana değil)");
// Önceki hâlde `Number.isFinite(ham) ? ham : 1` yazıyordu: Infinity gelince
// koltuk 1 olup EN UCUZ basamak seçiliyordu — sınırsız şoför 900 TL'ye gelirdi.
bekle("Infinity → 1.800", fiyatBasamagi("YONETIM", Number.POSITIVE_INFINITY).brut === 1800);
bekle("-Infinity → 900 (tabana kelepçe)", fiyatBasamagi("YONETIM", Number.NEGATIVE_INFINITY).brut === 900);
bekle("NaN → 900 (taban makul varsayılan)", fiyatBasamagi("YONETIM", Number.NaN).brut === 900);

console.log("\nMERDİVEN LİSTESİ — kurucu doğru diziyi gezer");
bekle(
  "merdiven() → 900/1.200/1.500/1.800",
  JSON.stringify(merdiven().map((b) => b.brut)) === JSON.stringify([900, 1200, 1500, 1800]),
);
bekle(
  "merdiven(true) → 600/900/1.200/1.500",
  JSON.stringify(merdiven(true).map((b) => b.brut)) === JSON.stringify([600, 900, 1200, 1500]),
);

console.log("\nKİLİTLİ FİYAT — kurucu kilidi merdivenin ÜSTÜNDE");
const ILERI = new Date(Date.now() + 30 * 86400_000);
const GECMIS = new Date(Date.now() - 86400_000);
bekle("kilit yok → basamak", tahsilEdilecekBrut("YONETIM", 2, null) === 1200);
bekle(
  "kilit var + süresi geçerli → KİLİT kazanır",
  tahsilEdilecekBrut("YONETIM", 2, { priceGrossLocked: 900, priceLockedUntil: ILERI }) === 900,
);
bekle(
  "kilit SÜRESİ DOLMUŞ → basamağa döner",
  tahsilEdilecekBrut("YONETIM", 2, { priceGrossLocked: 900, priceLockedUntil: GECMIS }) === 1200,
);
bekle(
  "tarihsiz kilit → süresiz sayılır",
  tahsilEdilecekBrut("YONETIM", 3, { priceGrossLocked: 600, priceLockedUntil: null }) === 600,
);
bekle(
  "tutarsız kilit (tarih var tutar yok) → kilit sayılmaz",
  tahsilEdilecekBrut("YONETIM", 1, { priceGrossLocked: null, priceLockedUntil: ILERI }) === 900,
);
bekle(
  "VİTRİN kilitten etkilenmez → 0",
  tahsilEdilecekBrut("VITRIN", 3, { priceGrossLocked: 900, priceLockedUntil: ILERI }) === 0,
);

console.log("\nPLAN REFERANSI EŞLEMESİ — tam eşleşme + UUID biçimi");
const GECERLI_UUID = "2fa6d038-0ab2-42ed-b8b1-cdf133fda1b1";
process.env.IYZICO_PLAN_REF_900 = GECERLI_UUID;
process.env.IYZICO_PLAN_REF_1200 = "<BULUNAMADI>";
process.env.IYZICO_PLAN_REF_1500 = "  " + GECERLI_UUID + "  ";
bekle("900 → referans döner", getIyzicoPlanRefByGross(900) === GECERLI_UUID);
bekle("boşluklu değer kırpılır", getIyzicoPlanRefByGross(1500) === GECERLI_UUID);
bekle(
  "🔑 <BULUNAMADI> yer tutucusu REDDEDİLİR (fail-open kapandı)",
  getIyzicoPlanRefByGross(1200) === "",
);
bekle("merdiven dışı tutar (1.499,60) → boş", getIyzicoPlanRefByGross(1499.6) === "");
bekle("merdiven dışı tutar (950) → boş", getIyzicoPlanRefByGross(950) === "");
bekle("planı env'de olmayan tutar → boş", getIyzicoPlanRefByGross(1800) === "");
bekle("0 ve negatif → boş", getIyzicoPlanRefByGross(0) === "" && getIyzicoPlanRefByGross(-900) === "");

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi === 0 ? 0 : 1);
