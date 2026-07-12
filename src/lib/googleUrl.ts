// İşletmenin Google Haritalar / İşletme profili linkini doğrular ve normalize
// eder. Yalnız gerçek Google alan adlarını kabul eder (rastgele link + XSS
// yüzeyini kapatır); kabul edilirse temiz URL, değilse null döner.

const ALLOWED_HOSTS = [
  "google.com",
  "maps.google.com",
  "maps.app.goo.gl",
  "goo.gl",
  "g.page",
  "share.google",
];

/** Geçerliyse normalize edilmiş URL, değilse null. */
export function normalizeGoogleProfileUrl(raw: string): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  // alt alan adları dahil (ör. www.google.com, maps.google.com)
  const host = u.hostname.toLowerCase();
  const ok = ALLOWED_HOSTS.some((h) => host === h || host.endsWith("." + h));
  if (!ok) return null;
  // Yalnız origin + path + query (fragment ve olası kimlik bilgileri temizlenir)
  return u.origin + u.pathname + u.search;
}
