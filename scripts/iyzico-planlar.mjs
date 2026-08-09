// iyzico ABONELİK PLANLARI — okuma + eksikleri açma (FIYAT-2026-08-09.md §1-A merdiveni)
//
// Neden ayrı script: `iyzico-setup.mjs` ürünü SIFIRDAN yaratıyor ve tek plan
// mantığına göre yazılmış. Fiyat merdivenine geçerken ürünü YENİDEN YARATMAK
// felakettir — mevcut abonelikler eski ürünün planına bağlı. Bu yüzden burada
// önce ürün ve planlar OKUNUR, sonra yalnız EKSİK olanlar açılır.
//
// KULLANIM
//   Okuma (varsayılan, hiçbir şey değiştirmez — önce BUNU çalıştır):
//     node scripts/iyzico-planlar.mjs
//   Eksik planları açma:
//     node scripts/iyzico-planlar.mjs --olustur
//
// Ortam değişkenleri: IYZICO_API_KEY, IYZICO_SECRET, IYZICO_BASE_URL
// (canlı: https://api.iyzipay.com · sandbox: https://sandbox-api.iyzipay.com)
// Ürün elle seçilecekse: IYZICO_PRODUCT_REFERENCE=...
//
// ⚠️ PLAN SİLİNMEZ, PASİFLEŞTİRİLİR: eski 2.400 TL planına bağlı abonelikler
// varken o planı silme — yeni plana taşınana kadar duracak (DEVIR §8).
import Iyzipay from "iyzipay";

const { IYZICO_API_KEY, IYZICO_SECRET, IYZICO_BASE_URL, IYZICO_PRODUCT_REFERENCE } = process.env;
if (!IYZICO_API_KEY || !IYZICO_SECRET || !IYZICO_BASE_URL) {
  console.error("IYZICO_API_KEY / IYZICO_SECRET / IYZICO_BASE_URL gerekli.");
  process.exit(1);
}
const OLUSTUR = process.argv.includes("--olustur");
const CANLI = !IYZICO_BASE_URL.includes("sandbox");

const iyzipay = new Iyzipay({
  apiKey: IYZICO_API_KEY,
  secretKey: IYZICO_SECRET,
  uri: IYZICO_BASE_URL,
});

const cagir = (kaynak, metod, istek) =>
  new Promise((resolve, reject) =>
    kaynak[metod](istek, (err, sonuc) => (err ? reject(err) : resolve(sonuc))),
  );

// FIYAT-2026-08-09.md §1-A. Fiyatlar KDV DAHİL (iyzico'ya tahsil edilen tutar gider).
//
// PLAN = FİYAT, paket değil. Kurucu merdiveni listeden 300 TL aşağıdadır, yani
// "kurucu + 2 şoför" ile "liste + 1 şoför" AYNI tutarı öder (900). Paket başına
// ayrı plan açmak aynı fiyattan iki plan yaratır; hangisinin çekildiğini ayırt
// etmek imkânsızlaşır ve mutabakat bozulur. Bu yüzden iyzico'da BEŞ fiyat durur,
// hangi müşterinin hangi basamakta olduğunu KOD tutar:
//   liste : 1 şoför 900 · 2 şoför 1.200 · 3 şoför 1.500 · 4+ 1.800
//   kurucu: 1 şoför 600 · 2 şoför  900  · 3 şoför 1.200 · 4+ 1.500
//
// KURUCU ayrı PLAN'dır, `discountPercent` DEĞİL — indirimli işletme iyzico
// düzenli ödeme talimatı veremiyor (odeme/abonelik/page.tsx:39-41 redirect'i),
// indirimle verilseydi kurucu müşteri her ay elle ödemek zorunda kalırdı.
const HEDEF_PLANLAR = [
  { env: "IYZICO_PLAN_REF_600", ad: "Abonelik — 600 TL/ay", fiyat: "600.0" },
  { env: "IYZICO_PLAN_REF_900", ad: "Abonelik — 900 TL/ay", fiyat: "900.0" },
  { env: "IYZICO_PLAN_REF_1200", ad: "Abonelik — 1.200 TL/ay", fiyat: "1200.0" },
  { env: "IYZICO_PLAN_REF_1500", ad: "Abonelik — 1.500 TL/ay", fiyat: "1500.0" },
  { env: "IYZICO_PLAN_REF_1800", ad: "Abonelik — 1.800 TL/ay", fiyat: "1800.0" },
];

const planIstek = (productReferenceCode, ad, fiyat) => ({
  locale: Iyzipay.LOCALE.TR,
  productReferenceCode,
  name: ad,
  price: fiyat,
  currencyCode: "TRY",
  paymentInterval: "MONTHLY",
  paymentIntervalCount: 1,
  planPaymentType: "RECURRING",
});

const veri = (r) => r?.data ?? r;
const liste = (r) => {
  const d = veri(r);
  return d?.items ?? d?.pricingPlans ?? d?.products ?? (Array.isArray(d) ? d : []);
};

try {
  console.log(`Bağlantı: ${IYZICO_BASE_URL} ${CANLI ? "🔴 CANLI" : "🟢 sandbox"}`);
  console.log(`Kip: ${OLUSTUR ? "OLUŞTUR (yazma)" : "OKUMA (değişiklik yok)"}\n`);

  // 1) ÜRÜN
  let productRef = IYZICO_PRODUCT_REFERENCE;
  if (!productRef) {
    const urunler = await cagir(iyzipay.subscriptionProduct, "retrieveList", {
      locale: Iyzipay.LOCALE.TR,
      page: 1,
      count: 100,
    });
    const items = liste(urunler);
    if (!items.length) {
      console.error("Hiç abonelik ÜRÜNÜ yok. Önce scripts/iyzico-setup.mjs ile ürün açılmalı.");
      console.error("Ham yanıt:", JSON.stringify(urunler, null, 2));
      process.exit(1);
    }
    console.log(`ÜRÜNLER (${items.length}):`);
    for (const u of items) console.log(`  - ${u.name}  →  ${u.referenceCode}`);
    // Birden fazla ürün varsa seçimi İNSANA bırak: yanlış ürüne plan açmak
    // sessizce çalışır ve hata ancak ilk tahsilatta görünür.
    if (items.length > 1) {
      console.error(
        "\nBirden fazla ürün var. IYZICO_PRODUCT_REFERENCE=<kod> ile hangisi olduğunu belirt.",
      );
      process.exit(1);
    }
    productRef = items[0].referenceCode;
    console.log(`\nSeçilen ürün: ${items[0].name} (${productRef})\n`);
  }

  // 2) MEVCUT PLANLAR
  const planlar = await cagir(iyzipay.subscriptionPricingPlan, "retrieveList", {
    locale: Iyzipay.LOCALE.TR,
    productReferenceCode: productRef,
    page: 1,
    count: 100,
  });
  const mevcut = liste(planlar);
  console.log(`MEVCUT PLANLAR (${mevcut.length}):`);
  for (const p of mevcut) {
    console.log(
      `  - ${String(p.name ?? "?").padEnd(42)} ${String(p.price ?? "?").padStart(9)} ${p.currencyCode ?? ""}  ${p.referenceCode ?? ""}  ${p.status ?? ""}`,
    );
  }

  // Eşleştirme FİYATA göre yapılır — ad değişebilir, tahsil edilen tutar değişemez.
  const fiyatKey = (v) => Number(v).toFixed(2);
  const mevcutFiyatlar = new Map(mevcut.map((p) => [fiyatKey(p.price), p]));

  const eksikler = HEDEF_PLANLAR.filter((h) => !mevcutFiyatlar.has(fiyatKey(h.fiyat)));
  console.log(`\nHEDEF MERDİVEN: ${HEDEF_PLANLAR.length} plan · EKSİK: ${eksikler.length}`);
  for (const e of eksikler) console.log(`  eksik → ${e.ad}`);

  if (!OLUSTUR) {
    console.log("\nOkuma kipi bitti. Açmak için: node scripts/iyzico-planlar.mjs --olustur");
    process.exit(0);
  }

  // 3) EKSİKLERİ AÇ
  const acilan = [];
  for (const h of eksikler) {
    const sonuc = await cagir(
      iyzipay.subscriptionPricingPlan,
      "create",
      planIstek(productRef, h.ad, h.fiyat),
    );
    const ref = veri(sonuc)?.referenceCode;
    if (!ref) {
      console.error(`AÇILAMADI: ${h.ad}`, JSON.stringify(sonuc, null, 2));
      continue;
    }
    acilan.push({ ...h, ref });
    console.log(`  açıldı → ${h.ad}  ${ref}`);
  }

  // 4) .env SATIRLARI
  console.log("\n=== .env SATIRLARI (sunucudaki /opt/hali/.env'e) ===");
  console.log(`IYZICO_PRODUCT_REFERENCE=${productRef}`);
  for (const h of HEDEF_PLANLAR) {
    const ref =
      acilan.find((a) => a.env === h.env)?.ref ??
      mevcutFiyatlar.get(fiyatKey(h.fiyat))?.referenceCode ??
      "<BULUNAMADI>";
    console.log(`${h.env}=${ref}`);
  }
  console.log(
    "\n⚠️ Eski IYZICO_PLAN_REFERENCE + IYZICO_PLAN_AMOUNT satırlarını SİLME —" +
      "\n   mevcut aboneler yeni plana taşınana kadar duracak (DEVIR §8).",
  );
} catch (e) {
  console.error("HATA:", e);
  process.exit(1);
}
