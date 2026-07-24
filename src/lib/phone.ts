// Türkiye telefon doğrulama.
//  - Cep: 05XX + 7 hane = 11 hane (SMS/OTP yalnız buraya gider).
//  - Sabit hat: 0 + il kodu + numara = 11 hane; il koduna göre değişir
//    (0212 İstanbul, 0342 Gaziantep, 0322 Adana...). İkinci hane 2/3/4'tür.
// İŞLETME İLETİŞİM numarası ikisi de olabilir (halı yıkamacıların çoğu sabit
// hat kullanır). Müşteriye SMS gidenler (sipariş onayı, OTP) CEP olmalı.

/** Cep VEYA sabit hat — 11 hane, 0 + [2-5]. */
export const TR_PHONE_RE = /^0[2-5]\d{9}$/;
/** Yalnız cep — SMS/OTP gönderilecek numaralar için. */
export const TR_MOBILE_RE = /^05\d{9}$/;
/** Yalnız sabit hat — 0 + il kodu (2/3/4 ile başlar), 11 hane. */
export const TR_LANDLINE_RE = /^0[2-4]\d{9}$/;

/** Girişi 11 haneli 0XXXXXXXXXX biçimine getirir (+90/90 ön eki, eksik 0). */
export function normalizePhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("90") && d.length === 12) d = d.slice(2);
  if (d.length === 10 && !d.startsWith("0")) d = "0" + d;
  return d;
}

/** Geçerli TR telefonu (cep veya sabit hat) — işletme iletişim numarası için. */
export function isTrPhone(p: string): boolean {
  return TR_PHONE_RE.test(p);
}

/** Cep telefonu — SMS/OTP alacak numaralar için. */
export function isMobilePhone(p: string): boolean {
  return TR_MOBILE_RE.test(p);
}

/** Sabit hat — işletme profilindeki "Sabit Hat" alanı için. */
export function isLandlinePhone(p: string): boolean {
  return TR_LANDLINE_RE.test(p);
}

// iyzico GSM doğrulaması operatör kodunu da kontrol eder: 05xx yeterli değil,
// tahsis edilmiş bir kod olmalı (0500/0520 gibi boş kodlar REDDEDİLİR).
// Türkiye'de tahsisli mobil kodlar: 501-509, 530-539, 541-549, 551-559, 561, 599.
const TR_GSM_OPERATOR_RE = /^05(0[1-9]|3\d|4[1-9]|5[1-9]|61|99)\d{7}$/;

/** iyzico'ya gönderilebilecek gerçek bir cep mi (operatör kodu tahsisli)? */
export function isRealMobilePhone(p: string): boolean {
  return TR_GSM_OPERATOR_RE.test(normalizePhone(p));
}

/** Adaylar içinden iyzico'nun kabul edeceği ilk cebi seç (+90… biçiminde).
 *  Sahip numarası sabit hatsa işletmenin 2. GSM'i devreye girer (çoklu telefon).
 *  Hiçbiri uygun değilse null → çağıran anlaşılır hata gösterir. */
export function pickIyzicoGsm(...adaylar: (string | null | undefined)[]): string | null {
  for (const a of adaylar) {
    const n = normalizePhone(a ?? "");
    if (isRealMobilePhone(n)) return "+90" + n.slice(1);
  }
  return null;
}
