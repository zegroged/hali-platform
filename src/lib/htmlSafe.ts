// HTML/JSON-LD güvenli çıktı yardımcıları — kullanıcı serbest metni (işletme
// adı, adres, müşteri adı) çıktı bağlamında yorumlanmasın.

/** HTML gövdesine/attribute'a gömülecek metni kaçır (e-posta şablonları vb.). */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// <, >, & ve satır-ayırıcı U+2028/U+2029. Sonraki ikisi kaynağa düz karakter
// yazılırsa parser'ı bozduğundan char-code ile kurulur (regex/dize literaline
// hiç özel karakter girmez → kaçış-seviyesi hatası imkânsız).
const JSONLD_UNSAFE = new RegExp(
  "[<>&" + String.fromCharCode(0x2028) + String.fromCharCode(0x2029) + "]",
  "g",
);

/**
 * `<script type="application/ld+json">` içine güvenle basılabilecek JSON üretir.
 * JSON.stringify yukarıdaki karakterleri kaçırmadığından değer içindeki
 * `</script>` script tag'inden çıkıp stored XSS'e yol açar. Her birini JSON'da
 * geçerli `\uXXXX` dizisine çevir (tarayıcı script'i bozmaz, JSON.parse aynı
 * değeri geri verir).
 */
export function jsonLdSafe(obj: unknown): string {
  return JSON.stringify(obj).replace(
    JSONLD_UNSAFE,
    (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}
