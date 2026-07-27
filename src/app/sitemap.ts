import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { CITIES, districtSlug, districtsOfCity } from "@/lib/cities";
import { seoKapsam, ilceAnahtar, gizliFiltre } from "@/lib/seoCoverage";

const BASE =
  process.env.APP_BASE_URL ?? "https://enyakinhaliyikamaservisi.com";

// Statik sayfalar + görünür/doğrulanmış halıcı profilleri.
// force-dynamic ŞART: bu olmadan Next sitemap'i BUILD anında prerender ediyor;
// Docker build'de DB erişilemediği için catch dalının statik-yalnız çıktısı
// kalıcı gömülüyordu (canlıda yakalandı, 2026-07-02). Artık her istek DB'den okur.
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/takip`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/kayit`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/abonelik`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/sss`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/hakkimizda`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE}/iletisim`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE}/kvkk`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/gizlilik`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/kosullar`, changeFrequency: "yearly", priority: 0.2 },
    {
      url: `${BASE}/isletme-sozlesmesi`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    { url: `${BASE}/mesafeli-satis`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/iade`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/on-bilgilendirme`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/sehirler`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/isletmeler-icin`, changeFrequency: "monthly", priority: 0.7 },
  ];

  // DB'ye ulaşılamazsa sitemap yine de statik sayfalarla dönsün (500 yerine).
  try {
    // İL/İLÇE SAYFALARI: yalnız HALICISI OLANLAR bildirilir (2026-07-27).
    // Eskiden 81 il + 973 ilçenin TAMAMI koşulsuz gönderiliyordu; canlıda ise
    // 4 il / ~10 ilçede halıcı var. Google'a bildirilen adreslerin ~%98'i boş
    // sayfaydı ve bu, yeni alan adının dizine girmesini hızlandırmak yerine
    // geciktiriyordu (doorway/ince içerik örüntüsü). Ayrıntı: lib/seoCoverage.ts.
    // Boş sayfalar silinmedi — kullanıcıya açık, yalnız `noindex` alıyorlar.
    const kapsam = await seoKapsam();
    const yerler: MetadataRoute.Sitemap = [
      ...CITIES.filter((c) => kapsam.iller.has(c.name)).map((c) => ({
        url: `${BASE}/hali-yikama/${c.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...CITIES.filter((c) => kapsam.iller.has(c.name)).flatMap((c) =>
        districtsOfCity(c.name)
          .filter((d) => kapsam.ilceler.has(ilceAnahtar(c.name, d)))
          .map((d) => ({
            url: `${BASE}/hali-yikama/${c.slug}/${districtSlug(d)}`,
            changeFrequency: "weekly" as const,
            priority: 0.6,
          })),
      ),
    ];

    const businesses = await prisma.cleanerBusiness.findMany({
      where: {
        isVisible: true,
        verification: { not: "REJECTED" },
        ...gizliFiltre(), // test/demo işletmesi Google'a bildirilmez
      },
      select: { id: true, updatedAt: true },
    });
    const profiles: MetadataRoute.Sitemap = businesses.map((b) => ({
      url: `${BASE}/halici/${b.id}`,
      lastModified: b.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
    return [...statics, ...yerler, ...profiles];
  } catch {
    return statics;
  }
}
