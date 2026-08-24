// İşletme adı/açıklaması normalize — "HERKES BÜYÜK HARFLE YAZIYOR" sorunu.
// Türkçe büyük/küçük harf JS toLowerCase ile BOZULUR (İ→i̇ birleşik nokta,
// I→i) — bu yüzden tr-TR locale'li dönüşüm kullanılır.

const trLower = (s: string) => s.toLocaleLowerCase("tr-TR");
const trUpper = (s: string) => s.toLocaleUpperCase("tr-TR");

/** Kelime başları büyük, kalanı küçük: "HİJYEN HALİ YIKAMA" → "Hijyen Hali Yıkama".
 *  Boşluk, tire ve parantezle ayrılan parçaların ilk harfi büyütülür
 *  ("öz-kar" → "Öz-Kar", "(test)" → "(Test)"). */
export function trTitleCase(input: string): string {
  return trLower(input.trim())
    .replace(/(^|[\s\-(/])(\S)/g, (_m, sep: string, ch: string) => sep + trUpper(ch))
    // Bağlaçlar küçük kalır: "Halı Ve Koltuk" → "Halı ve Koltuk" (baştaysa dokunma).
    .replace(/(\S\s)(Ve|İle)(\s)/g, (_m, a: string, b: string, c: string) => a + trLower(b) + c);
}

/** Harflerin ne kadarı büyük? (rakam/noktalama sayılmaz) */
function upperRatio(input: string): number {
  const letters = input.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, "");
  if (!letters.length) return 0;
  const uppers = letters.replace(/[^A-ZÇĞİÖŞÜ]/g, "");
  return uppers.length / letters.length;
}

/** Cümle başları büyük, kalanı küçük (". ! ? \n" sonrası ilk harf). */
function trSentenceCase(input: string): string {
  return trLower(input).replace(
    /(^|[.!?]\s+|\n\s*)(\S)/g,
    (_m, sep: string, ch: string) => sep + trUpper(ch),
  );
}

/** İşletme adı: HER ZAMAN kelime-başı büyük düzene çekilir (kartlarda tekdüze görünüm). */
export function normalizeBusinessName(name: string): string {
  return trTitleCase(name);
}

/** Açıklama: yalnız "bağıran" metin (harflerin >%60'ı büyük) cümle düzenine
 *  çekilir — düzgün yazılmış metindeki özel adlar bozulmasın. */
export function normalizeBusinessDescription(text: string): string {
  const t = text.trim();
  if (t.length > 10 && upperRatio(t) > 0.6) return trSentenceCase(t);
  return t;
}

/** Adres (işletme/fatura/sipariş alım): kelime-başı büyük düzen —
 *  "ÇİÇEK MAH. GÜL SK. NO: 12" → "Çiçek Mah. Gül Sk. No: 12". */
export function normalizeAddress(address: string): string {
  return trTitleCase(address);
}
