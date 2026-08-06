// ROLÜN AÇILIŞ SAYFASI — TEK KAYNAK (2026-08-04).
//
// Bu harita `/giris` sayfasında yaşıyordu ("use client" dosyası). Mobil
// uygulama da aynı yönlendirmeyi yapmak zorunda (tek giriş ekranı, rol nereye
// düşerse oraya) — kopyalansaydı klasik İKİZ MANTIK tuzağı olurdu: biri
// güncellenir, öteki sessizce eski sayfaya atardı. Artık iki taraf da buradan
// okuyor.
export const ROLE_HOME: Record<string, string> = {
  CLEANER: "/panel",
  // Dükkân çalışanı sahiple AYNI panele girer; farkı yetkisidir, adresi değil
  // (sahibe özel sayfalar hem gezinmede gizli hem sayfa kapısıyla kapalı).
  STAFF: "/panel",
  DRIVER: "/sofor",
  ADMIN: "/admin",
  SUPPORT: "/destek",
  ACCOUNTANT: "/muhasebe",
  AGENT: "/komisyoncu",
  CUSTOMER: "/hesabim",
};

/** Rolün açılış sayfası; bilinmeyen rolde ana sayfa. */
export function roleHome(role: string | null | undefined): string {
  return (role && ROLE_HOME[role]) || "/";
}
