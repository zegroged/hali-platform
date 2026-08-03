// Abonelik paketi TEK yerde tanımlanır — /abonelik sayfası ve /kayit funnel'ı
// aynı kaynağı okur; fiyat/kapsam değişince iki sayfa birden güncel kalır.
// (Fiyat sözleşmeyle uyumlu olmalı: isletme-sozlesmesi §3.)
// ÜCRETSİZ DENEME YOK (2026-07-07 kararı): abonelik ödemeyle başlar,
// ödemesi alınmayan işletme yayına alınmaz. Fiyat KDV HARİÇ anılır
// (kartta "₺2.000 + KDV / ay"), sözleşme §3 ile birebir aynı.
export const PLAN = {
  name: "İşletme Aboneliği",
  priceAmount: "2.000", // kart görünümünde "₺2.000 + KDV" olarak basılır
  priceMonthly: "2.000 TL + KDV",
  kdvRate: 20,
  priceNetMonthly: "2.000,00",
  kdvMonthly: "400,00",
  priceGrossMonthly: "2.400,00",
  // iyzico'ya gönderilen KDV DAHİL sayısal tutar (tahsil edilen). Görünen
  // metinlerle (yukarısı) tutarlı olmalı.
  priceGrossNumber: 2400,
  // SIRA KASITLIDIR (2026-07-29). Bu liste halıcının PARAYI ÖDERKEN gördüğü
  // "pakete dahil olanlar"dı ve ilk iki maddesi görünürlük/sipariş vaadiydi —
  // yani bedelin karşılığı müşteri olarak ilan ediliyordu. Canlıda tüm
  // zamanlarda 3 teslim edilmiş sipariş, 0 yorum var. Artık önce çalışan
  // yazılım sayılıyor; keşifte listelenme taahhütsüz biçimde sonda.
  // KASA listede HİÇ YOKTU — panelde çalışan bir defter satılmadan duruyordu.
  // 2026-08-03: liste ürünün GELDİĞİ yeri anlatmıyordu — Halı Bul, WhatsApp
  // bildirimleri, mutabakat ve gelen kutusu hiç geçmiyordu. Dil de kuruydu
  // ("sipariş yönetim paneli"); halıcı özellik değil DERDİNİN ÇÖZÜMÜNÜ okur.
  features: [
    "Sipariş defteri: gelen iş listede durur, tek dokunuşla ilerler — kâğıt, karalama, unutma yok",
    "Müşteriye otomatik WhatsApp ve e-posta: “halım ne oldu?” telefonları kesilir",
    "Kesin fiyat onayı: tutarı sen bildirirsin, müşteri kendi telefonundan onaylar, kayıtta kalır",
    "Alım ve teslimde fotoğraflı kayıt: hasar tartışmasında kanıt sende",
    "Halı Bul: dükkândaki halıların fotoğraf duvarı — hangi halı kimin, numarasıyla belli",
    "Şoför takibi: mesai boyunca canlı konum, dünkü rota, hangi adreste kaç dakika durduğu",
    "Gün sonu mutabakat: şoförün üzerinde ne kadar nakit kaldı, tek ekranda",
    "KASA: gelir-gider defteri, her ay kendiliğinden düşen sabit giderler, kâr-zarar özeti",
    "Dükkâna gelen müşteri için takip kodlu manuel kayıt — sokaktan gelen iş de aynı defterde",
    "Sipariş başına komisyon yok, ciro payı yok, taahhüt yok: istediğin ay bırakırsın",
    "Bölgenin arama ve ilçe sayfasında listelenme — bunun için ayrıca ücret alınmaz",
  ],
} as const;
