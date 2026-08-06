import { prisma } from "@/lib/prisma";
import { activeSubscriptionWhere } from "@/lib/subscription";
import { normalizeCityName, normalizeDistrictName } from "@/lib/cities";

// ARAMA MOTORU KAPSAMI (2026-07-27) — "Google'da hiç çıkmıyoruz" sorununun kökü.
//
// TEŞHİS: sitemap 81 il + 973 ilçe = ~1.054 adresi Google'a bildiriyordu; oysa
// canlıda YALNIZ 4 ilde ve ~10 ilçede halıcı var. Yani gönderdiğimiz adreslerin
// ~%98'i BOŞ sayfaydı. Yeni bir alan adı, birbirine benzeyen binlerce boş sayfa
// bildirdiğinde Google bunu "kapı sayfası" (doorway) örüntüsü sayar: tarama
// bütçesini boş sayfalarda harcar, sitenin tamamının kalite puanını düşürür ve
// dizine almayı geciktirir. Kalabalık sitemap yardım etmiyor, ZARAR veriyordu.
//
// ÇÖZÜM: Google'a yalnız İÇERİĞİ OLAN sayfaları bildir. Boş il/ilçe sayfaları
// SİLİNMEZ (kullanıcı için dururlar; "açılınca haber ver" formu oradan çalışıyor)
// ama `noindex` alır ve sitemap'e girmez. O ile ilk halıcı girdiği anda sayfa
// kendiliğinden indexlenebilir hâle gelir — elle iş yok.
//
// Buradaki filtre keşifle (lib/businesses.ts getBusinesses) AYNI olmalı; yoksa
// "sitemap'te var ama sayfa boş" çelişkisi doğar.

export type Kapsam = {
  iller: Set<string>;
  ilceler: Set<string>;
  // SAYFAYA ÖZGÜ META AÇIKLAMA İÇİN (2026-08-06). Her il/ilçe sayfasının
  // description'ı aynı kalıptan üretiliyordu ("<il>'de halı yıkama servisi:
  // yakınındaki halıcıları karşılaştır…"). Google bunu şablon içerik sayar ve
  // kendi ürettiği bir parçayla DEĞİŞTİRİR — yani yazdığımız metin boşa gider.
  // Bu sayaçlar açıklamaya o sayfaya AİT gerçek bir bilgi koymayı sağlıyor
  // ("3 halı yıkamacı, 7 ilçede hizmet").
  ilSayaci: Map<string, number>;
  ilceSayaci: Map<string, number>;
  /** İl → o ilde hizmet verilen ilçe adları (açıklamada ilk birkaçı geçer). */
  ilIlceleri: Map<string, Set<string>>;
};

/** "İl|İlçe" — küme anahtarı (normalize edilmiş adlarla). */
export function ilceAnahtar(il: string, ilce: string): string {
  return `${il}|${ilce}`;
}

/** Halıcısı olan il ve ilçeleri çıkar (kendi konumu VEYA hizmet bölgesi). */
export async function seoKapsam(): Promise<Kapsam> {
  const iller = new Set<string>();
  const ilceler = new Set<string>();
  const ilSayaci = new Map<string, number>();
  const ilceSayaci = new Map<string, number>();
  const ilIlceleri = new Map<string, Set<string>>();
  // Sayaç İŞLETME başına artar (hizmet bölgesi başına DEĞİL): bir işletme aynı
  // ilde 10 ilçeye hizmet veriyorsa il sayacı 1 artmalı, 10 değil.
  const ilGoruldu = new Set<string>();
  const ilceGoruldu = new Set<string>();
  const ekle = (ilRaw: string | null, ilceRaw: string | null) => {
    const il = normalizeCityName(ilRaw ?? "");
    if (!il) return;
    iller.add(il);
    if (!ilGoruldu.has(il)) {
      ilGoruldu.add(il);
      ilSayaci.set(il, (ilSayaci.get(il) ?? 0) + 1);
    }
    const ilce = normalizeDistrictName(il, ilceRaw ?? "");
    if (ilce) {
      const anahtar = ilceAnahtar(il, ilce);
      ilceler.add(anahtar);
      if (!ilceGoruldu.has(anahtar)) {
        ilceGoruldu.add(anahtar);
        ilceSayaci.set(anahtar, (ilceSayaci.get(anahtar) ?? 0) + 1);
      }
      const set = ilIlceleri.get(il) ?? new Set<string>();
      set.add(ilce);
      ilIlceleri.set(il, set);
    }
  };

  const isletmeler = await prisma.cleanerBusiness.findMany({
    where: {
      isVisible: true,
      verification: { not: "REJECTED" },
      subscription: activeSubscriptionWhere(),
      ...gizliFiltre(),
    },
    select: {
      city: true,
      district: true,
      serviceAreas: { select: { city: true, district: true } },
    },
  });
  for (const b of isletmeler) {
    // Her işletme için "görüldü" kümeleri sıfırlanır → sayaçlar işletme başına.
    ilGoruldu.clear();
    ilceGoruldu.clear();
    ekle(b.city, b.district);
    for (const sa of b.serviceAreas) ekle(sa.city, sa.district);
  }
  return { iller, ilceler, ilSayaci, ilceSayaci, ilIlceleri };
}

/** Aramaya kapatılan işletmeler (test/demo kaydı). Virgüllü kimlik listesi. */
export function seoGizliIdler(): string[] {
  return (process.env.SEO_NOINDEX_BUSINESS_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Prisma `where` eki: gizli işletmeleri dışarıda bırakır.
 *
 * İKİ KAYNAK:
 *  1) env'deki kimlik listesi (elle kapatılan tek tük test kaydı),
 *  2) `isDemo` — komisyoncunun dükkânda gösterdiği DEMO paneli (2026-07-30).
 *
 * NEDEN isDemo BURADA: bu fonksiyon keşif (lib/businesses.ts), sitemap,
 * il/ilçe kapsamı (seoKapsam), ana sayfa il butonları (lib/supplyCities.ts) ve
 * "şehrinde halıcı açıldı" müjde maili (lib/cityLeads.ts) tarafından ORTAK
 * kullanılıyor. Tek yere yazılınca beşi birden korunur; ayrı ayrı yazılsaydı
 * biri unutulur ve uydurma bir işletme gerçek müşteriye çıkardı.
 */
export function gizliFiltre() {
  const idler = seoGizliIdler();
  return {
    isDemo: false,
    // 🔴 `id` DEĞİL `AND` (2026-07-30 denetim bulgusu — KRİTİK).
    // Eskiden `{ id: { notIn: [...] } }` dönüyordu ve bu nesne yayıldığında
    // ÇAĞIRANIN KENDİ `id` FİLTRESİNİ EZİYORDU. Somut hasar: cityLeads.ts'te
    // `{ id: businessId, ...gizliFiltre() }` yazılmıştı → businessId filtresi
    // yok oluyor, "şehrinde halıcı açıldı" müjde maili YANLIŞ işletme için
    // tetiklenebiliyordu. Aynı tuzak api/orders/[token] alternatif önerisinde
    // de vardı (`id: { not: ... }` eziliyordu).
    // `AND` ayrı bir anahtar olduğu için hiçbir çağıranın filtresini bozmaz;
    // üst seviyede AND kullanan çağıran yok (kontrol edildi).
    ...(idler.length ? { AND: [{ id: { notIn: idler } }] } : {}),
  };
}

/** Bu işletme aramaya kapalı mı? (profil sayfasında noindex için) */
export function seoGizliMi(id: string): boolean {
  return seoGizliIdler().includes(id);
}
