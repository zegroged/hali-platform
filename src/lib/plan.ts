// Abonelik paketi TEK yerde tanımlanır — /abonelik sayfası ve /kayit funnel'ı
// aynı kaynağı okur; fiyat/kapsam değişince iki sayfa birden güncel kalır.
// (Fiyat sözleşmeyle uyumlu olmalı: isletme-sozlesmesi §3.)
export const PLAN = {
  name: "İşletme Aboneliği",
  priceAmount: "2.000", // kart görünümünde "₺2.000" olarak basılır
  priceMonthly: "2.000 TL",
  trialDays: 30,
  // Sipariş özeti dökümü — 2.000 TL KDV DAHİL kabul edildi (sözleşme §3
  // "2.000 TL/ay" der, hariç demez). KDV hariç olacaksa: net 2.000,00 /
  // KDV 400,00 / toplam 2.400,00 yap + sözleşme metnini güncelle.
  kdvRate: 20,
  priceNetMonthly: "1.666,67",
  kdvMonthly: "333,33",
  priceGrossMonthly: "2.000,00",
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
