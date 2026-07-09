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
  features: [
    "Keşif sayfalarında bölgendeki müşterilere görünürlük",
    "Sınırsız sipariş talebi — sipariş başına komisyon yok",
    "Sipariş yönetim paneli (onay, adım adım ilerletme, kesin fiyat bildirimi)",
    "Şoför yönetimi ve mesai boyunca canlı konum takibi",
    "Rota geçmişi ve aylık durak raporu",
    "Alım ve teslimde fotoğraflı kanıt",
    "Dükkâna gelen müşterin için takip kodlu manuel sipariş kaydı",
    "Doğrulanmış İşletme rozeti ile güven",
  ],
} as const;
