// Vergi No (10 hane) ve TC Kimlik No (11 hane) doğrulaması — resmî kontrol
// basamağı algoritmalarıyla. Rastgele/uydurma numaraları matematiksel olarak
// eler (gerçek varlık kontrolü DEĞİL — o, devlet servisi/belge ister; bu ilk
// savunma katmanı: format + checksum). Şahıs işletmesi TC, tüzel kişi VKN verir.

/** TC Kimlik No algoritması (NVİ): 11 hane, ilk hane 0 olamaz, 10. ve 11. haneler checksum. */
export function isValidTCKN(v: string): boolean {
  if (!/^[1-9][0-9]{10}$/.test(v)) return false;
  const d = v.split("").map(Number);
  const oddSum = d[0] + d[2] + d[4] + d[6] + d[8]; // 1,3,5,7,9. haneler
  const evenSum = d[1] + d[3] + d[5] + d[7]; // 2,4,6,8. haneler
  // (7·tek − çift) NEGATİF olabilir; JS %'si negatif döndürür ve gerçek TC'yi
  // reddederdi. +10 %10 ile daima 0-9 aralığına çekilir.
  const digit10 = (((oddSum * 7 - evenSum) % 10) + 10) % 10;
  if (digit10 !== d[9]) return false;
  const digit11 = d.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
  return digit11 === d[10];
}

/** Vergi Kimlik No algoritması (GİB): 10 hane, son hane checksum. */
export function isValidVKN(v: string): boolean {
  if (!/^[0-9]{10}$/.test(v)) return false;
  const d = v.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const tmp = (d[i] + (9 - i)) % 10;
    // tmp=9 → 9 (aksi halde 9%9=0 yanlış olur); tmp=0 → 0; diğerleri (tmp·2^(9-i))%9.
    sum += tmp === 9 ? 9 : (tmp * 2 ** (9 - i)) % 9;
  }
  const check = sum % 10 === 0 ? 0 : 10 - (sum % 10);
  return check === d[9];
}

/**
 * Halıcıdan alınan vergi/kimlik no'yu doğrular. Şahıs işletmesi 11 hane TC,
 * tüzel kişi 10 hane VKN girer — ikisinden biri geçerliyse kabul.
 */
export function isValidTaxOrTckn(raw: string): boolean {
  const v = (raw ?? "").replace(/\D/g, "");
  if (v.length === 11) return isValidTCKN(v);
  if (v.length === 10) return isValidVKN(v);
  return false;
}

/**
 * Geçersiz girişte NE yanlış onu söyleyen hedefli hata mesajı (geçerliyse null).
 * "TC veya VKN geçersiz" gibi belirsiz uyarı yerine hane sayısını ve hangi
 * numara türünün denendiğini açıkça belirtir.
 */
export function taxIdError(raw: string): string | null {
  const v = (raw ?? "").replace(/\D/g, "");
  if (v.length === 0) return null; // boş bırakılabilir — karar çağırana ait
  if (v.length === 11) {
    return isValidTCKN(v)
      ? null
      : "11 haneli T.C. kimlik numarası doğrulanamadı — rakamları kontrol edip yeniden girin.";
  }
  if (v.length === 10) {
    return isValidVKN(v)
      ? null
      : "10 haneli vergi numarası doğrulanamadı — rakamları kontrol edip yeniden girin.";
  }
  return `${v.length} hane girdiniz — T.C. kimlik 11, vergi numarası 10 hane olmalı.`;
}

/**
 * Müşteriye açık sayfada gösterilecek vergi kimlik no. 10 haneli VKN (tüzel
 * kişi) ETAHS md.5/2-b gereği gösterilir; 11 haneli TCKN kişisel veridir
 * (KVKK) — ASLA gösterilmez, null döner.
 */
export function publicTaxNumber(raw: string | null): string | null {
  const v = (raw ?? "").replace(/\D/g, "");
  return v.length === 10 ? v : null;
}
