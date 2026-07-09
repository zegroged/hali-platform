// Kullanıcı adı: telefonun yerini alan giriş kimliği.
//
// Telefon doğrulanmadığı (SMS mock) için giriş kimliği olmaktan çıkarıldı.
// Giriş artık DOĞRULANMIŞ e-posta veya kullanıcı adı ile yapılır.

/** Girişte e-posta mı kullanıcı adı mı yazıldığını ayırt eden işaret. */
export function looksLikeEmail(identifier: string): boolean {
  return identifier.includes("@");
}

/**
 * Depolama ve arama için tek biçim: kırpılmış + küçük harf.
 * AYNI fonksiyon hem yazarken hem okurken kullanılır — böylece "Ahmet" ile
 * kaydolan "ahmet" yazarak da girebilir ve "Ahmet"/"ahmet" iki ayrı hesap olamaz
 * (@unique kısıtı küçük harfli değer üzerinde çalışır).
 *
 * Türkçe tuzağı: "İ".toLowerCase() → "i" + U+0307 (birleşik nokta) döner; bu
 * görünmez karakter izinli-karakter kuralına takılırdı. Onu ayıklıyoruz ki
 * "İbrahim" → "ibrahim" olsun.
 */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/̇/g, "");
}

const MIN = 3;
const MAX = 30;
// Türkçe harfler dahil; "@" YASAK — girişte e-postadan ayırt edilmesini bozardı.
const ALLOWED = /^[a-z0-9çğıöşü._-]+$/;

/**
 * Normalize edilmiş kullanıcı adını doğrular.
 * @returns hata mesajı (Türkçe) ya da geçerliyse null
 */
export function validateUsername(normalized: string): string | null {
  if (normalized.length < MIN)
    return `Kullanıcı adı en az ${MIN} karakter olmalı.`;
  if (normalized.length > MAX)
    return `Kullanıcı adı en fazla ${MAX} karakter olabilir.`;
  if (!ALLOWED.test(normalized))
    return "Kullanıcı adı yalnız harf, rakam ve . _ - içerebilir (boşluk ve @ olamaz).";
  if (!/^[a-z0-9çğıöşü]/.test(normalized))
    return "Kullanıcı adı harf veya rakamla başlamalı.";
  // Salt rakam olursa telefon numarasıyla karışır — kullanıcıyı yanıltmayalım.
  if (/^\d+$/.test(normalized))
    return "Kullanıcı adı yalnız rakamlardan oluşamaz.";
  return null;
}
