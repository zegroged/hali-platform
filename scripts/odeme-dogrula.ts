/**
 * ÖDEME ZİNCİRİ DOĞRULAMASI (2026-08-10) — para HAREKET ETTİRMEZ.
 *
 * NE DOĞRULAR: "ekranda yazan tutar" ile "iyzico'da bağlanacak plan" aynı şey mi.
 * Bu zincir merdivene geçerken kırılabilecek en pahalı yerdi: tutar bir global
 * env'den, plan referansı başka bir global env'den geliyordu — ekranda 900
 * yazıp karttan 2.400 çekilebilirdi.
 *
 * Zincir: merdiven basamağı → `getIyzicoPlanRefByGross` (uygulamanın KENDİ
 * fonksiyonu) → iyzico'dan o planı OKU → planın fiyatı basamakla aynı mı,
 * planı ACTIVE mi.
 *
 * NE DOĞRULAMAZ: gerçek karttan çekim. O yalnız gerçek kartla, gerçek 3D
 * ekranıyla olur ve para hareketi doğurur — bu betik bilerek oraya girmez.
 *
 * KULLANIM (sunucudaki anahtarlarla, yerelden):
 *   set -a; eval "$(ssh root@SUNUCU 'grep -E "^IYZICO_" /opt/hali/.env')"; set +a
 *   FIYAT_MERDIVENI=1 PAYMENTS_MODE=live npx tsx scripts/odeme-dogrula.ts
 */
import Iyzipay from "iyzipay";
import { merdiven, fiyatBasamagi, SOFOR_TAVANI, PLAN_TUTARLARI } from "../src/lib/plan";
import { getIyzicoPlanRefByGross, recurringPlanFor } from "../src/lib/config";

const { IYZICO_API_KEY, IYZICO_SECRET, IYZICO_BASE_URL } = process.env;
if (!IYZICO_API_KEY || !IYZICO_SECRET || !IYZICO_BASE_URL) {
  console.error("IYZICO_API_KEY / IYZICO_SECRET / IYZICO_BASE_URL gerekli.");
  process.exit(1);
}

const iyzipay = new Iyzipay({
  apiKey: IYZICO_API_KEY,
  secretKey: IYZICO_SECRET,
  uri: IYZICO_BASE_URL,
});
const cagir = (kaynak: any, metod: string, istek: unknown) =>
  new Promise<any>((resolve, reject) =>
    kaynak[metod](istek, (e: unknown, r: unknown) => (e ? reject(e) : resolve(r))),
  );

let hata = 0;
const kontrol = (ad: string, kosul: boolean, ek = "") => {
  console.log((kosul ? "  ✓ " : "  ✗ ") + ad + (ek ? ` — ${ek}` : ""));
  if (!kosul) hata++;
};

async function main() {
  console.log(`Bağlantı: ${IYZICO_BASE_URL}\n`);

  // 1) MERDİVENİN HER BASAMAĞI + KURUCU TABANI
  const basamaklar = merdiven().map((b, i) => ({
    ad: b.sinirsiz ? "Sınırsız şoför" : `${i + 1} şoför`,
    brut: b.brut,
  }));
  // Kurucu tabanı (600) merdiven dizisinde yok; ayrıca sınanmalı.
  const kurucuTaban = fiyatBasamagi("YONETIM", 1, true).brut;
  const hedefler = [...basamaklar, { ad: "Kurucu (1 şoför)", brut: kurucuTaban }];

  console.log("— Tutar → plan referansı → iyzico —");
  for (const h of hedefler) {
    const ref = getIyzicoPlanRefByGross(h.brut);
    if (!ref) {
      kontrol(`${h.ad} (${h.brut} TL) referans bulundu`, false, "env'de yok/geçersiz");
      continue;
    }
    let plan: any = null;
    try {
      plan = await cagir(iyzipay.subscriptionPricingPlan, "retrieve", {
        locale: Iyzipay.LOCALE.TR,
        pricingPlanReferenceCode: ref,
      });
    } catch (e) {
      kontrol(`${h.ad} (${h.brut} TL) iyzico'dan okundu`, false, String(e));
      continue;
    }
    const d = plan?.data ?? plan;
    const fiyat = Number(d?.price);
    kontrol(
      `${h.ad}: ekrandaki ${h.brut} TL = iyzico planı ${fiyat} TL`,
      Math.abs(fiyat - h.brut) < 0.005,
      `ref ${ref.slice(0, 8)}… durum ${d?.status ?? "?"}`,
    );
    kontrol(`${h.ad}: plan ACTIVE`, d?.status === "ACTIVE", String(d?.status));
    kontrol(
      `${h.ad}: para birimi TRY`,
      !d?.currencyCode || d.currencyCode === "TRY",
      String(d?.currencyCode),
    );
  }

  // 2) FAIL-CLOSED: merdiven dışı tutar talimat AÇMAMALI
  console.log("\n— Fail-closed —");
  for (const yanlis of [950, 1499.6, 0, -900, 2400]) {
    kontrol(
      `${yanlis} TL için talimat açılmıyor`,
      recurringPlanFor(yanlis) === null,
      yanlis === 2400 ? "eski fiyat da kapalı olmalı" : "",
    );
  }

  // 3) KOD ile PLAN LİSTESİ tutarlı mı
  console.log("\n— Kapsam —");
  const uretilen = new Set<number>();
  for (const kurucu of [false, true])
    for (let n = 1; n <= SOFOR_TAVANI + 2; n++)
      uretilen.add(fiyatBasamagi("YONETIM", n, kurucu).brut);
  for (const t of uretilen)
    kontrol(`kodun ürettiği ${t} TL PLAN_TUTARLARI içinde`, (PLAN_TUTARLARI as readonly number[]).includes(t));

  console.log(
    hata
      ? `\n${hata} KONTROL BAŞARISIZ — bu hâliyle tahsilat YANLIŞ TUTAR çekebilir.`
      : "\nZİNCİR SAĞLAM: ekranda yazan tutar ile iyzico planı birebir aynı.",
  );
  console.log(
    "NOT: gerçek karttan çekim bu betikle sınanmaz (para hareketi doğurur).",
  );
  process.exit(hata ? 1 : 0);
}

main().catch((e) => {
  console.error("HATA:", e);
  process.exit(1);
});
