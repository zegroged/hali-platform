// ============================================================
// TİCARİ KÜNYE — TEK KAYNAK
//
// Değerler ORTAM DEĞİŞKENİNDEN okunur; depoda kişisel/yasal veri tutulmaz.
// Tanımlı değilse "[...]" yer tutucusu döner ve kunyeTamam() false olur.
//
// Yasal zorunluluk: ETAHS Yön. md.6/1 ve Mesafeli Sözleşmeler Yön. gereği
// bu bilgiler sitede gösterilmek ZORUNDADIR. Üretimde .env doldurulmalıdır;
// aksi halde yasal sayfalar eksik bilgiyle yayına çıkar.
// ============================================================

export const SIRKET = {
  /** Markanın ticari adı (kişisel veri değil). */
  ticariAd: process.env.NEXT_PUBLIC_SIRKET_TICARI_AD ?? "En Yakın Halı Yıkama",
  /** İşleticinin yasal adı — şahıs işletmesinde ad soyad. */
  yasalAd: process.env.NEXT_PUBLIC_SIRKET_YASAL_AD ?? "[YASAL AD]",
  /** "(şahıs işletmesi)" gibi tür ibaresi. */
  isletmeTuru: process.env.NEXT_PUBLIC_SIRKET_ISLETME_TURU ?? "şahıs işletmesi",
  /** Açık adres. */
  adres: process.env.NEXT_PUBLIC_SIRKET_ADRES ?? "[ADRES]",
  /** Şehir/ilçe — adresten ayrı, kısa gösterimler için. */
  sehir: process.env.NEXT_PUBLIC_SIRKET_SEHIR ?? "[ŞEHİR]",
  vergiDairesi: process.env.NEXT_PUBLIC_SIRKET_VERGI_DAIRESI ?? "[VERGİ DAİRESİ]",
  vergiNo: process.env.NEXT_PUBLIC_SIRKET_VERGI_NO ?? "[VKN]",
  /** Kayıtlı Elektronik Posta adresi. */
  kep: process.env.NEXT_PUBLIC_SIRKET_KEP ?? "[KEP]",
  telefon: process.env.NEXT_PUBLIC_SIRKET_TELEFON ?? "[TELEFON]",
  eposta: process.env.NEXT_PUBLIC_SIRKET_EPOSTA ?? "info@enyakinhaliyikamaservisi.com",
} as const;

/** Zorunlu künye alanlarının hepsi doldurulmuş mu? */
export function kunyeTamam(): boolean {
  return ![
    SIRKET.yasalAd,
    SIRKET.adres,
    SIRKET.vergiDairesi,
    SIRKET.vergiNo,
    SIRKET.kep,
  ].some((v) => v.startsWith("["));
}

/** "Ad Soyad (şahıs işletmesi)" biçiminde tek satır. */
export const isleticiTamAd = `${SIRKET.yasalAd} (${SIRKET.isletmeTuru})`;

/** "Vergi Dairesi / VKN" biçiminde vergi bilgisi. */
export const vergiSatiri = `${SIRKET.vergiDairesi} / ${SIRKET.vergiNo}`;
