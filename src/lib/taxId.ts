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
  const digit10 = (oddSum * 7 - evenSum) % 10;
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
