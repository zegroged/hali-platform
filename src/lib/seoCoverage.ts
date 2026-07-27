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

export type Kapsam = { iller: Set<string>; ilceler: Set<string> };

/** "İl|İlçe" — küme anahtarı (normalize edilmiş adlarla). */
export function ilceAnahtar(il: string, ilce: string): string {
  return `${il}|${ilce}`;
}

/** Halıcısı olan il ve ilçeleri çıkar (kendi konumu VEYA hizmet bölgesi). */
export async function seoKapsam(): Promise<Kapsam> {
  const iller = new Set<string>();
  const ilceler = new Set<string>();
  const ekle = (ilRaw: string | null, ilceRaw: string | null) => {
    const il = normalizeCityName(ilRaw ?? "");
    if (!il) return;
    iller.add(il);
    const ilce = normalizeDistrictName(il, ilceRaw ?? "");
    if (ilce) ilceler.add(ilceAnahtar(il, ilce));
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
    ekle(b.city, b.district);
    for (const sa of b.serviceAreas) ekle(sa.city, sa.district);
  }
  return { iller, ilceler };
}

/** Aramaya kapatılan işletmeler (test/demo kaydı). Virgüllü kimlik listesi. */
export function seoGizliIdler(): string[] {
  return (process.env.SEO_NOINDEX_BUSINESS_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Prisma `where` eki: gizli işletmeleri dışarıda bırakır. */
export function gizliFiltre() {
  const idler = seoGizliIdler();
  return idler.length ? { id: { notIn: idler } } : {};
}

/** Bu işletme aramaya kapalı mı? (profil sayfasında noindex için) */
export function seoGizliMi(id: string): boolean {
  return seoGizliIdler().includes(id);
}
