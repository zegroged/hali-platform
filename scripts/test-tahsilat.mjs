// TAHSİLAT MUTABAKATI — BİRİM TESTİ (2026-07-29)
//
// Neden var: bu hesap PARA konuşuyor ve "derlendi, herhalde çalışıyor"
// yetmez. Docker/DB olmadan çalışır: node scripts/test-tahsilat.mjs
//
// Çalıştırma:  npm run test:tahsilat
// (lib/tahsilat.ts önce tsc ile .tmp-test/ altına derlenir; elle regex ile tip
//  soymayı denedim, kırılgan çıktı — derleyicinin kendisi doğru araç.)

import { strict as assert } from "node:assert";

// TypeScript'i kendi derleyicisiyle soyuyoruz — elle regex ile tip silmek
// kirilgan (ilk denemede fonksiyon donus tipinde patladi).
// Calistirma: npx tsc src/lib/tahsilat.ts --outDir .tmp-test --target es2022 --module esnext
//            && node scripts/test-tahsilat.mjs
const { mutabakatHesapla, gunAraligi, bugunISO } = await import(
  "../.tmp-test/tahsilat.js"
);

let gecti = 0;
function t(ad, fn) {
  try {
    fn();
    gecti++;
    console.log("  ✓ " + ad);
  } catch (e) {
    console.error("  ✗ " + ad + "\n    " + e.message);
    process.exitCode = 1;
  }
}

console.log("TAHSİLAT MUTABAKATI");

t("boş girdi sıfır döner", () => {
  const r = mutabakatHesapla([], []);
  assert.equal(r.satirlar.length, 0);
  assert.equal(r.toplamTahsilat, 0);
  assert.equal(r.toplamBekleyen, 0);
});

t("tahsil edilen ve edilmeyen ayrılır", () => {
  const r = mutabakatHesapla(
    [
      { orderId: "1", driverId: "d1", driverName: "Ahmet", tutar: 800, tahsilEdildi: true },
      { orderId: "2", driverId: "d1", driverName: "Ahmet", tutar: 500, tahsilEdildi: false },
    ],
    [],
  );
  const s = r.satirlar[0];
  assert.equal(s.teslimat, 2);
  assert.equal(s.tahsilat, 800);
  assert.equal(s.tahsilEdilmeyen, 500);
  assert.equal(s.bekleyen, 800, "devir yoksa tahsilatın tamamı şoförde");
});

t("devir bakiyeyi düşürür", () => {
  const r = mutabakatHesapla(
    [
      { orderId: "1", driverId: "d1", driverName: "Ahmet", tutar: 8400, tahsilEdildi: true },
    ],
    [{ driverId: "d1", tutar: 6000 }],
  );
  assert.equal(r.satirlar[0].bekleyen, 2400, "8.400 tahsil, 6.000 devir → 2.400 üzerinde");
});

t("teslimatı olmayan ama devir yapan şoför KAYBOLMAZ", () => {
  // Dün topladığı parayı bugün getiren şoför. Satır düşerse bakiye yanlış çıkar.
  const r = mutabakatHesapla([], [{ driverId: "d9", tutar: 1500 }]);
  assert.equal(r.satirlar.length, 1);
  assert.equal(r.satirlar[0].devredilen, 1500);
  assert.equal(r.satirlar[0].bekleyen, -1500, "fazla devir eksi bakiye gösterir");
});

t("panelden teslim (şoförsüz) ayrı satırda", () => {
  const r = mutabakatHesapla(
    [{ orderId: "1", driverId: null, driverName: null, tutar: 300, tahsilEdildi: true }],
    [],
  );
  assert.equal(r.satirlar[0].driverName, "Panelden (halıcı)");
  assert.equal(r.satirlar[0].driverId, null);
});

t("üzerinde en çok para bekleyen üstte", () => {
  const r = mutabakatHesapla(
    [
      { orderId: "1", driverId: "a", driverName: "Az", tutar: 100, tahsilEdildi: true },
      { orderId: "2", driverId: "b", driverName: "Çok", tutar: 9000, tahsilEdildi: true },
    ],
    [],
  );
  assert.equal(r.satirlar[0].driverName, "Çok");
});

t("kuruş hatası birikmez", () => {
  const teslimler = Array.from({ length: 3 }, (_, i) => ({
    orderId: String(i),
    driverId: "d1",
    driverName: "A",
    tutar: 0.1,
    tahsilEdildi: true,
  }));
  const r = mutabakatHesapla(teslimler, []);
  assert.equal(r.satirlar[0].tahsilat, 0.3, "0.1*3 kayan nokta hatası vermemeli");
});

t("bozuk tutar (NaN) toplamı bozmaz", () => {
  const r = mutabakatHesapla(
    [
      { orderId: "1", driverId: "d1", driverName: "A", tutar: Number.NaN, tahsilEdildi: true },
      { orderId: "2", driverId: "d1", driverName: "A", tutar: 500, tahsilEdildi: true },
    ],
    [],
  );
  assert.equal(r.satirlar[0].tahsilat, 500);
});

console.log("\nIBAN AYRIMI (2026-07-30)");

t("IBAN tahsilatı şoförde nakit BIRAKMAZ", () => {
  // Para bankaya geçtiyse şoförden istenmez. Karışırsa halıcı olmayan parayı ister.
  const r = mutabakatHesapla(
    [
      { orderId: "1", driverId: "d1", driverName: "A", tutar: 1000, tahsilEdildi: true, yontem: "CASH" },
      { orderId: "2", driverId: "d1", driverName: "A", tutar: 2500, tahsilEdildi: true, yontem: "IBAN" },
    ],
    [],
  );
  const s = r.satirlar[0];
  assert.equal(s.tahsilat, 3500, "toplam tahsilat ikisini de sayar");
  assert.equal(s.ibanTahsilat, 2500);
  assert.equal(s.bekleyen, 1000, "şoförde YALNIZ nakit bekler");
});

t("yöntem verilmezse nakit sayılır (eski kayıtlar)", () => {
  const r = mutabakatHesapla(
    [{ orderId: "1", driverId: "d1", driverName: "A", tutar: 400, tahsilEdildi: true }],
    [],
  );
  assert.equal(r.satirlar[0].ibanTahsilat, 0);
  assert.equal(r.satirlar[0].bekleyen, 400);
});

t("tamamı IBAN ise şoför bakiyesi sıfır", () => {
  const r = mutabakatHesapla(
    [{ orderId: "1", driverId: "d1", driverName: "A", tutar: 5000, tahsilEdildi: true, yontem: "IBAN" }],
    [],
  );
  assert.equal(r.satirlar[0].bekleyen, 0, "banka hesabına gelen para şoförde beklemez");
  assert.equal(r.toplamIbanTahsilat, 5000);
});

console.log("\nSAAT DİLİMİ (Europe/Istanbul, sabit UTC+3)");

t("gün aralığı TR 00:00'da başlar", () => {
  const { bas, son } = gunAraligi("2026-07-29");
  assert.equal(bas.toISOString(), "2026-07-28T21:00:00.000Z", "TR 00:00 = UTC 21:00");
  assert.equal(son.toISOString(), "2026-07-29T21:00:00.000Z");
});

t("gece 01:00 teslimatı AYNI güne düşer", () => {
  // Bu, UTC ile hesaplayınca kaybolan teslimattır — halıcının "eksik" dediği.
  const { bas, son } = gunAraligi("2026-07-29");
  const teslim = new Date("2026-07-29T01:30:00+03:00");
  assert.ok(teslim >= bas && teslim < son, "TR 29 Temmuz 01:30 → 29 Temmuz günü");
});

t("bugünISO TR gününü verir", () => {
  // UTC'de hâlâ 28'i ama TR'de 29'u olan an
  assert.equal(bugunISO(new Date("2026-07-28T22:00:00Z")), "2026-07-29");
  assert.equal(bugunISO(new Date("2026-07-29T20:59:00Z")), "2026-07-29");
});

console.log(`\n${gecti} test geçti${process.exitCode ? " (HATA VAR)" : ""}`);
