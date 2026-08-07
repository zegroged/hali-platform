// KONUM SÜZGECİ TESTİ — `npm run test:konum`
//
// NEDEN VAR (DEVIR'in en pahalı dersi, 4.64a): konum süzgecinin İLK sürümü
// "tsc geçti + deploy oldu" diye BİTMİŞ sayıldı; kullanıcı *"emin misin?"*
// diye sorunca gerçek veriyle sınandı ve **işe yaramadığı** görüldü.
// Bir daha olmasın diye kurallar artık burada, sayıyla kilitli.
//
// Gerçek prod izi varsa (`scripts/veri/konum-ornek.json`) o da sınanır;
// yoksa yalnız sentetik senaryolar çalışır ve betik bunu açıkça söyler.
//
// 🔒 O dosya ANONİMLEŞTİRİLMİŞTİR (KVKK): gerçek şoförlerin izleri boylamda
// +40° kaydırıldı ve saatler sabit bir tabana çekildi. Enlem ve TÜM göreli
// mesafeler/süreler birebir aynı kaldığı için testin değeri değişmez —
// ölçümler kaydırmadan önce ve sonra RAKAMI RAKAMINA aynı çıktı.
// Yeni iz eklerken aynı yolu izle; ham koordinat depoya girmesin.
//
// Ölçtüğümüz şey KULLANICININ ŞİKÂYETİ: "şoför evden çıkmadı ama harita yol
// çizdi." Yani metrik = HARİTAYA ÇİZİLEN YOLUN UZUNLUĞU. Park hâlinde 0 olmalı.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { izHazirla, metre, type IzNoktasi } from "@/lib/konumFiltre";

let hata = 0;
function bekle(ad: string, kosul: boolean, ayrinti: string) {
  if (kosul) {
    console.log(`  ✓ ${ad}`);
  } else {
    hata++;
    console.log(`  ✗ ${ad} — ${ayrinti}`);
  }
}

/** Çizilen yolun toplam uzunluğu (m) — kullanıcının gördüğü "gezinti". */
function cizgiUzunlugu(cizgi: [number, number][]): number {
  let t = 0;
  for (let i = 1; i < cizgi.length; i++) {
    t += metre(
      { lat: cizgi[i - 1][0], lng: cizgi[i - 1][1] },
      { lat: cizgi[i][0], lng: cizgi[i][1] },
    );
  }
  return Math.round(t);
}

// Konya merkez civarı — 1° enlem ≈ 111 km, 1° boylam ≈ 111 km × cos(37,87°).
const LAT0 = 37.8746;
const LNG0 = 32.4932;
const M_LAT = 1 / 111_000;
const M_LNG = 1 / (111_000 * Math.cos((LAT0 * Math.PI) / 180));
const SN = 1000;

function nokta(kuzeyM: number, doguM: number, saniye: number): IzNoktasi {
  return {
    lat: LAT0 + kuzeyM * M_LAT,
    lng: LNG0 + doguM * M_LNG,
    t: saniye * SN,
  };
}

console.log("\nKONUM SÜZGECİ — sentetik senaryolar\n");

// ── 1) PARK + GPS TİTREMESİ ────────────────────────────────────────────────
// 20 dakika park; her dakika ±8 m titreme. Ham iz ~300 m "gezinti" çizer.
{
  const ham: IzNoktasi[] = [];
  for (let i = 0; i < 20; i++) {
    ham.push(nokta((i % 3) * 8 - 8, ((i * 7) % 5) * 8 - 16, i * 60));
  }
  const { cizgi, duruyor } = izHazirla(ham);
  bekle(
    "park titremesi tek noktaya iner",
    cizgiUzunlugu(cizgi) === 0 && duruyor,
    `çizilen ${cizgiUzunlugu(cizgi)} m, duruyor=${duruyor} (ham ${cizgiUzunlugu(
      ham.map((p) => [p.lat, p.lng] as [number, number]),
    )} m)`,
  );
}

// ── 2) PARK + YAVAŞ SÜRÜKLENME (DEVIR §5-B/2'deki 2. boşluk) ───────────────
// 60 dakika park; konum dakikada 5 m kayıyor → toplam 300 m.
// ESKİ SÜZGEÇ: 60 m yarıçapı adım adım aşılıyordu → 300 m'lik sahte yol.
{
  const ham: IzNoktasi[] = [];
  for (let i = 0; i < 60; i++) ham.push(nokta(i * 5, 0, i * 60));
  const { cizgi } = izHazirla(ham);
  bekle(
    "yavaş sürüklenme (300 m / 60 dk) yutulur",
    cizgiUzunlugu(cizgi) === 0,
    `çizilen ${cizgiUzunlugu(cizgi)} m — 0 bekleniyordu`,
  );
}

// ── 3) PARK + ARDIŞIK İKİ SAPMIŞ FIX (§5-B/2'deki 1. boşluk) ───────────────
// Park hâlinde iki fix üst üste 300 m ötede; sonra geri dönüyor.
{
  const ham: IzNoktasi[] = [];
  for (let i = 0; i < 8; i++) ham.push(nokta(0, i * 3, i * 60));
  ham.push(nokta(300, 20, 8 * 60));
  ham.push(nokta(305, 25, 9 * 60));
  for (let i = 10; i < 18; i++) ham.push(nokta(0, i * 3, i * 60));
  const { cizgi } = izHazirla(ham);
  bekle(
    "ardışık İKİ sapmış fix ayıklanır",
    cizgiUzunlugu(cizgi) === 0,
    `çizilen ${cizgiUzunlugu(cizgi)} m — 0 bekleniyordu`,
  );
}

// ── 4) ARDIŞIK ÜÇ SAPMIŞ FIX ───────────────────────────────────────────────
{
  const ham: IzNoktasi[] = [];
  for (let i = 0; i < 8; i++) ham.push(nokta(0, i * 3, i * 30));
  ham.push(nokta(300, 20, 8 * 30));
  ham.push(nokta(310, 25, 9 * 30));
  ham.push(nokta(295, 15, 10 * 30));
  for (let i = 11; i < 20; i++) ham.push(nokta(0, i * 3, i * 30));
  const { cizgi } = izHazirla(ham);
  bekle(
    "ardışık ÜÇ sapmış fix ayıklanır",
    cizgiUzunlugu(cizgi) === 0,
    `çizilen ${cizgiUzunlugu(cizgi)} m — 0 bekleniyordu`,
  );
}

// ── 5) GERÇEK SÜRÜŞ KORUNUR (prod ölçümü: 22 ve 56 km/sa) ──────────────────
// 5 sn'de bir örnek, 30 m adım = 21,6 km/sa. 40 nokta = 1,2 km.
{
  const ham: IzNoktasi[] = [];
  for (let i = 0; i < 40; i++) ham.push(nokta(i * 30, 0, i * 5));
  const { cizgi, duruyor } = izHazirla(ham);
  const uzunluk = cizgiUzunlugu(cizgi);
  bekle(
    "gerçek sürüş (21,6 km/sa) dokunulmadan çizilir",
    !duruyor && uzunluk >= 1100 && cizgi.length === 40,
    `çizilen ${uzunluk} m / ${cizgi.length} nokta — ~1170 m / 40 nokta bekleniyordu`,
  );
}

// ── 6) VERİ BOŞLUĞU DURUŞ SANILMAZ ─────────────────────────────────────────
// Akşam evde park, gece uygulama kapalı, sabah 3 km ötede açılıyor.
// Hız 0,07 m/sn ("yavaş") ama duruş DEĞİL — mesafe kapısı bunu yakalamalı.
{
  const ham: IzNoktasi[] = [
    nokta(0, 0, 0),
    nokta(5, 5, 60),
    nokta(10, 0, 120),
    nokta(3000, 200, 12 * 3600),
    nokta(3005, 205, 12 * 3600 + 60),
    nokta(3010, 200, 12 * 3600 + 120),
  ];
  const { cizgi } = izHazirla(ham);
  bekle(
    "12 saatlik boşluktan sonraki 3 km atlama duruş sayılmaz",
    cizgi.length === 2 && cizgiUzunlugu(cizgi) > 2900,
    `çizilen ${cizgiUzunlugu(cizgi)} m / ${cizgi.length} nokta — 2 nokta ~3 km bekleniyordu`,
  );
}

// ── 7) KARIŞIK GÜN: sürüş → park → sürüş ───────────────────────────────────
{
  const ham: IzNoktasi[] = [];
  let sn = 0;
  for (let i = 0; i < 30; i++) ham.push(nokta(i * 30, 0, (sn += 5))); // 870 m sürüş
  for (let i = 0; i < 20; i++) ham.push(nokta(870 + (i % 3) * 6, 0, (sn += 60))); // 20 dk park
  for (let i = 0; i < 30; i++) ham.push(nokta(870 + i * 30, 0, (sn += 5))); // 870 m sürüş
  const { cizgi } = izHazirla(ham);
  const uzunluk = cizgiUzunlugu(cizgi);
  bekle(
    "sürüş+park+sürüş: park iner, sürüşler kalır",
    uzunluk > 1600 && uzunluk < 1850 && cizgi.length < 65,
    `çizilen ${uzunluk} m / ${cizgi.length} nokta — ~1740 m ve <65 nokta bekleniyordu`,
  );
}

// ── 8) GERÇEK PROD İZİ (varsa) ─────────────────────────────────────────────
// ⚠️ `new URL(...).pathname` Windows'ta "/C:/..." verir ve existsSync sessizce
// false döner — test "geçti" görünürken gerçek veri HİÇ koşmaz. fileURLToPath
// iki platformda da doğru yolu üretir.
const ornekYolu = fileURLToPath(new URL("./veri/konum-ornek.json", import.meta.url));
console.log("\nGERÇEK PROD İZİ\n");
if (existsSync(ornekYolu)) {
  const kayitlar = JSON.parse(readFileSync(ornekYolu, "utf8")) as {
    ad: string;
    noktalar: { lat: number; lng: number; t: number }[];
    beklenen?: { enFazlaMetre?: number; enAzMetre?: number };
  }[];
  for (const k of kayitlar) {
    const ham = k.noktalar;
    const hamUzunluk = cizgiUzunlugu(
      ham.map((p) => [p.lat, p.lng] as [number, number]),
    );
    const { cizgi, duruyor } = izHazirla(ham);
    const uzunluk = cizgiUzunlugu(cizgi);
    console.log(
      `  ${k.ad}: ${ham.length} nokta · ham ${hamUzunluk} m → çizilen ${uzunluk} m ` +
        `(${cizgi.length} nokta, duruyor=${duruyor})`,
    );
    if (k.beklenen?.enFazlaMetre != null) {
      bekle(
        `${k.ad} ≤ ${k.beklenen.enFazlaMetre} m`,
        uzunluk <= k.beklenen.enFazlaMetre,
        `çizilen ${uzunluk} m`,
      );
    }
    if (k.beklenen?.enAzMetre != null) {
      bekle(
        `${k.ad} ≥ ${k.beklenen.enAzMetre} m`,
        uzunluk >= k.beklenen.enAzMetre,
        `çizilen ${uzunluk} m`,
      );
    }
  }
} else {
  console.log(
    "  ⚠ scripts/veri/konum-ornek.json YOK — yalnız sentetik senaryolar koştu.\n" +
      "    Gerçek iz çekmek için: DEVIR §5-B/2 notundaki SQL ile prod'dan dök.",
  );
}

console.log(hata === 0 ? "\n✅ TÜM TESTLER GEÇTİ\n" : `\n❌ ${hata} TEST BAŞARISIZ\n`);
process.exit(hata === 0 ? 0 : 1);
