// iyzico ABONELİK kurulumu (DEVIR §8 adım 1) — Abonelik API'si production'da
// AÇILINCA bir kez çalıştırılır: ürün + 1 TL test planı + 2.400 TL gerçek plan
// oluşturur, referans kodlarını basar. Çıkan planReferenceCode değerlerinden
// önce 1 TL'lik test planı .env'e IYZICO_PLAN_REFERENCE olarak yazılır; gerçek
// kartla doğrulama sonrası 2.400 planına geçilir.
//
// KULLANIM (yerelden, canlı anahtarlarla):
//   IYZICO_API_KEY=... IYZICO_SECRET=... IYZICO_BASE_URL=https://api.iyzipay.com \
//     node scripts/iyzico-setup.mjs
// Sandbox denemesi için sandbox anahtarları + https://sandbox-api.iyzipay.com.
import Iyzipay from "iyzipay";

const { IYZICO_API_KEY, IYZICO_SECRET, IYZICO_BASE_URL } = process.env;
if (!IYZICO_API_KEY || !IYZICO_SECRET || !IYZICO_BASE_URL) {
  console.error("IYZICO_API_KEY / IYZICO_SECRET / IYZICO_BASE_URL ortam değişkenleri gerekli.");
  process.exit(1);
}

const iyzipay = new Iyzipay({
  apiKey: IYZICO_API_KEY,
  secretKey: IYZICO_SECRET,
  uri: IYZICO_BASE_URL,
});

const cagir = (kaynak, metod, istek) =>
  new Promise((resolve, reject) =>
    kaynak[metod](istek, (err, sonuc) => (err ? reject(err) : resolve(sonuc))),
  );

const urunIstek = {
  locale: Iyzipay.LOCALE.TR,
  name: "En Yakın Halı Yıkama — İşletme Aboneliği",
  description: "Aylık işletme aboneliği (isletme paketleri: /abonelik)",
};

const planIstek = (productReferenceCode, ad, fiyat) => ({
  locale: Iyzipay.LOCALE.TR,
  productReferenceCode,
  name: ad,
  price: fiyat, // KDV DAHİL tahsil edilen tutar (string)
  currencyCode: "TRY",
  paymentInterval: "MONTHLY",
  paymentIntervalCount: 1,
  planPaymentType: "RECURRING",
});

try {
  const urun = await cagir(iyzipay.subscriptionProduct, "create", urunIstek);
  console.log("ÜRÜN:", JSON.stringify(urun, null, 2));
  const productRef = urun?.data?.referenceCode ?? urun?.referenceCode;
  if (!productRef) {
    console.error("Ürün referansı alınamadı — yanıt yukarıda (100001 ise Abonelik API hâlâ kapalı).");
    process.exit(1);
  }

  const testPlan = await cagir(
    iyzipay.subscriptionPricingPlan,
    "create",
    planIstek(productRef, "Test Planı (1 TL)", "1.0"),
  );
  console.log("1 TL TEST PLANI:", JSON.stringify(testPlan, null, 2));

  const gercekPlan = await cagir(
    iyzipay.subscriptionPricingPlan,
    "create",
    planIstek(productRef, "İşletme Aboneliği (2.400 TL/ay)", "2400.0"),
  );
  console.log("2400 TL PLANI:", JSON.stringify(gercekPlan, null, 2));

  console.log("\n=== ÖZET ===");
  console.log("productReferenceCode:", productRef);
  console.log("1TL planReferenceCode:", testPlan?.data?.referenceCode ?? testPlan?.referenceCode);
  console.log("2400 planReferenceCode:", gercekPlan?.data?.referenceCode ?? gercekPlan?.referenceCode);
  console.log("→ .env: IYZICO_PLAN_REFERENCE=<önce 1 TL planı, doğrulanınca 2400 planı>");
} catch (e) {
  console.error("HATA:", e);
  process.exit(1);
}
