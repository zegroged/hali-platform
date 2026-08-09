// iyzico ABONELİK PLANLARI — okuma + eksikleri açma (FIYAT-2026-08-09.md §1-A).
//
// Neden ayrı script: `iyzico-setup.mjs` ürünü SIFIRDAN yaratıyor ve tek plan
// mantığına göre yazılmış. Fiyat merdivenine geçerken ürünü YENİDEN YARATMAK
// felakettir — mevcut abonelikler eski ürünün planına bağlı. Burada önce ürün
// ve planlar OKUNUR, sonra yalnız EKSİK olanlar açılır.
//
// 🔑 HEDEF LİSTE `src/lib/plan.ts`'TEN GELİR, BURADA TEKRAR YAZILMAZ.
// Önce iki ayrı elle-tutulan liste vardı (kod bir yerde, script başka yerde) ve
// test "kodun ürettiği her tutarın planı var mı" derken aslında plan.ts'i
// plan.ts ile karşılaştırıyordu — totoloji (denetim bulgusu). Artık tek kaynak.
//
// KULLANIM
//   Okuma (varsayılan, hiçbir şey değiştirmez — önce BUNU çalıştır):
//     npx tsx scripts/iyzico-planlar.ts
//   Eksik planları açma:
//     npx tsx scripts/iyzico-planlar.ts --olustur
//
// Ortam değişkenleri: IYZICO_API_KEY, IYZICO_SECRET, IYZICO_BASE_URL
// (canlı: https://api.iyzipay.com · sandbox: https://sandbox-api.iyzipay.com)
// Ürün elle seçilecekse: IYZICO_PRODUCT_REFERENCE=...
//
// ⚠️ PLAN SİLİNMEZ, PASİFLEŞTİRİLİR: eski 2.400 TL planına bağlı abonelikler
// varken o planı silme — yeni plana taşınana kadar duracak (DEVIR §8).
import Iyzipay from "iyzipay";
import { PLAN_TUTARLARI, PLAN } from "../src/lib/plan";

const { IYZICO_API_KEY, IYZICO_SECRET, IYZICO_BASE_URL, IYZICO_PRODUCT_REFERENCE } =
  process.env;
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

const cagir = (kaynak: any, metod: string, istek: unknown) =>
  new Promise<any>((resolve, reject) =>
    kaynak[metod](istek, (err: unknown, sonuc: unknown) =>
      err ? reject(err) : resolve(sonuc),
    ),
  );

// Plan adı tutardan türetilir; ad değişse bile EŞLEŞME FİYATA göre yapılır,
// çünkü tahsil edilen tutar değişemez ama ad kozmetiktir.
const planAdi = (tutar: number) =>
  `Abonelik — ${tutar.toLocaleString("tr-TR")} TL/ay`;

const planIstek = (productReferenceCode: string, tutar: number) => ({
  locale: Iyzipay.LOCALE.TR,
  productReferenceCode,
  name: planAdi(tutar),
  price: `${tutar}.0`, // KDV DAHİL tahsil edilen tutar
  currencyCode: "TRY",
  paymentInterval: "MONTHLY",
  paymentIntervalCount: 1,
  planPaymentType: "RECURRING",
});

const veri = (r: any) => r?.data ?? r;
const liste = (r: any): any[] => {
  const d = veri(r);
  return d?.items ?? d?.pricingPlans ?? d?.products ?? (Array.isArray(d) ? d : []);
};
const fiyatKey = (v: unknown) => Number(v).toFixed(2);

async function main() {
  console.log(`Bağlantı: ${IYZICO_BASE_URL} ${CANLI ? "🔴 CANLI" : "🟢 sandbox"}`);
  console.log(`Kip: ${OLUSTUR ? "OLUŞTUR (yazma)" : "OKUMA (değişiklik yok)"}`);
  console.log(`Hedef merdiven (src/lib/plan.ts): ${PLAN_TUTARLARI.join(", ")}\n`);

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
    // sessizce çalışır, hata ancak ilk tahsilatta görünür.
    if (items.length > 1) {
      console.error("\nBirden fazla ürün var. IYZICO_PRODUCT_REFERENCE=<kod> ile belirt.");
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
      `  - ${String(p.name ?? "?").padEnd(30)} ${String(p.price ?? "?").padStart(9)} ${p.currencyCode ?? ""}  ${p.referenceCode ?? ""}  ${p.status ?? ""}`,
    );
  }

  const fiyattanPlan = new Map<string, any>(mevcut.map((p) => [fiyatKey(p.price), p]));
  const eksikler = PLAN_TUTARLARI.filter((t) => !fiyattanPlan.has(fiyatKey(t)));

  // PARA BİRİMİ + TEKİLLİK DENETİMİ: aynı fiyattan iki plan varsa hangisinin
  // çekildiği ayırt edilemez; TRY olmayan bir plan sessizce yanlış para çeker.
  const sayac = new Map<string, number>();
  for (const p of mevcut) sayac.set(fiyatKey(p.price), (sayac.get(fiyatKey(p.price)) ?? 0) + 1);
  for (const t of PLAN_TUTARLARI) {
    const p = fiyattanPlan.get(fiyatKey(t));
    if (!p) continue;
    if ((sayac.get(fiyatKey(t)) ?? 0) > 1)
      console.error(`  ⚠️ ${t} TL için BİRDEN FAZLA plan var — hangisi çekilecek belirsiz.`);
    if (p.currencyCode && p.currencyCode !== "TRY")
      console.error(`  ⚠️ ${t} TL planının para birimi TRY değil: ${p.currencyCode}`);
    if (p.status && p.status !== "ACTIVE")
      console.error(`  ⚠️ ${t} TL planı ACTIVE değil: ${p.status}`);
  }

  console.log(`\nHEDEF: ${PLAN_TUTARLARI.length} plan · EKSİK: ${eksikler.length}`);
  for (const e of eksikler) console.log(`  eksik → ${planAdi(e)}`);

  if (!OLUSTUR) {
    console.log("\nOkuma kipi bitti. Açmak için: npx tsx scripts/iyzico-planlar.ts --olustur");
    return;
  }

  // 3) EKSİKLERİ AÇ
  for (const t of eksikler) {
    const sonuc = await cagir(
      iyzipay.subscriptionPricingPlan,
      "create",
      planIstek(productRef!, t),
    );
    const ref = veri(sonuc)?.referenceCode;
    if (!ref) {
      console.error(`AÇILAMADI: ${planAdi(t)}`, JSON.stringify(sonuc, null, 2));
      continue;
    }
    fiyattanPlan.set(fiyatKey(t), { ...veri(sonuc), referenceCode: ref, price: t });
    console.log(`  açıldı → ${planAdi(t)}  ${ref}`);
  }

  // 4) .env SATIRLARI
  //
  // ⚠️ EKSİK PLAN İÇİN SATIR BASILMAZ (denetim bulgusu): önceki hâl
  // `IYZICO_PLAN_REF_900=<BULUNAMADI>` gibi bir satır basıyordu. O satır .env'e
  // yapıştırılırsa şekilsiz dize "geçerli referans" sayılıp talimat FAIL-OPEN
  // açılırdı. Artık eksikler ayrı bir UYARI bloğunda, yapıştırılamaz biçimde.
  console.log("\n=== .env SATIRLARI (sunucudaki /opt/hali/.env'e) ===");
  console.log(`IYZICO_PRODUCT_REFERENCE=${productRef}`);
  const kalanEksik: number[] = [];
  for (const t of PLAN_TUTARLARI) {
    const ref = fiyattanPlan.get(fiyatKey(t))?.referenceCode;
    if (ref) console.log(`IYZICO_PLAN_REF_${t}=${ref}`);
    else kalanEksik.push(t);
  }
  if (kalanEksik.length) {
    console.error(
      `\n🔴 ŞU TUTARLARIN PLANI YOK: ${kalanEksik.join(", ")} — bunlar için satır BASILMADI.` +
        `\n   FIYAT_MERDIVENI=1 yapılırsa uygulama açılışta bu eksikliği söyleyerek durur.`,
    );
  }
  console.log(
    `\n⚠️ Eski IYZICO_PLAN_REFERENCE + IYZICO_PLAN_AMOUNT satırlarını SİLME —` +
      `\n   mevcut aboneler yeni plana taşınana kadar duracak (DEVIR §8).` +
      `\n   (Bugünkü tek fiyat: ${PLAN.priceGrossMonthly} TL)`,
  );
}

main().catch((e) => {
  console.error("HATA:", e);
  process.exit(1);
});
