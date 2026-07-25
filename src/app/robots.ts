import type { MetadataRoute } from "next";

// Arama motoru kuralları: kamusal sayfalar açık; panel/admin/şoför/giriş,
// API ve token'lı takip sayfaları (/takip/<token>) kapalı.
// Not: /takip (kod girme sayfası) bilerek açık — yalnız alt yolları kapatıyoruz.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/panel",
        "/admin",
        "/sofor",
        "/giris",
        "/takip/",
        "/api/",
        "/odeme", // talimat ödeme sayfası (panel dışı, yetkili)
        "/komisyoncu",
        "/muhasebe",
      ],
    },
    sitemap: "https://enyakinhaliyikamaservisi.com/sitemap.xml",
  };
}
