import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const BASE =
  process.env.APP_BASE_URL ?? "https://enyakinhaliyikamaservisi.com";

// Statik sayfalar + görünür/doğrulanmış halıcı profilleri.
// Halıcılar kaydoldukça sitemap otomatik büyür (build değil, istek anında üretilir).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/takip`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/kayit`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/sss`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/iletisim`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${BASE}/kvkk`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/gizlilik`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/kosullar`, changeFrequency: "yearly", priority: 0.2 },
  ];

  // DB'ye ulaşılamazsa sitemap yine de statik sayfalarla dönsün (500 yerine).
  try {
    const businesses = await prisma.cleanerBusiness.findMany({
      where: { isVisible: true, verification: "VERIFIED" },
      select: { id: true, updatedAt: true },
    });
    const profiles: MetadataRoute.Sitemap = businesses.map((b) => ({
      url: `${BASE}/halici/${b.id}`,
      lastModified: b.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
    return [...statics, ...profiles];
  } catch {
    return statics;
  }
}
