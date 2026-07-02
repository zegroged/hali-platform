// Tek kullanımlık/çöp e-posta servisleri — sahte işletme kaydını caydırır.
// Liste kısa tutuldu (en yaygınlar); yeni gördükçe ekle.
const DISPOSABLE_DOMAINS = new Set([
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "10minutemail.com",
  "10minutemail.net",
  "guerrillamail.com",
  "guerrillamail.net",
  "sharklasers.com",
  "mailinator.com",
  "yopmail.com",
  "yopmail.fr",
  "trashmail.com",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
  "fakeinbox.com",
  "mohmal.com",
  "minuteinbox.com",
  "throwawaymail.com",
  "mailnesia.com",
  "tempail.com",
  "tempr.email",
  "moakt.com",
  "emailondeck.com",
]);

/** E-posta çöp/tek-kullanımlık bir servise mi ait? */
export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  return domain ? DISPOSABLE_DOMAINS.has(domain) : false;
}
