// Abonelik paketi TEK yerde tanımlanır — /abonelik sayfası ve /kayit funnel'ı
// aynı kaynağı okur; fiyat/kapsam değişince iki sayfa birden güncel kalır.
// (Fiyat sözleşmeyle uyumlu olmalı: isletme-sozlesmesi §3.)
export const PLAN = {
  name: "İşletme Aboneliği",
  priceAmount: "2.000", // kart görünümünde "₺2.000" olarak basılır
  priceMonthly: "2.000 TL",
  trialDays: 30,
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
