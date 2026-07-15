export type Route =
  | { name: "home" }
  | { name: "profile"; id: string }
  | { name: "order"; id: string; businessName: string }
  // code = ekranda gösterilen kısa referans; token = API için UZUN takip token'ı
  // (kesin-fiyat onayı/iptal bununla çalışır — kısa kod yetkisiz).
  | { name: "track"; code?: string; token?: string }
  // Giriş / kayıt (değerlendirme + sipariş geçmişi için üyelik).
  | { name: "auth" };

export type Nav = {
  go: (r: Route) => void;
  /** Yığının tepesini değiştirir — sipariş sonrası "geri"nin boşalmış forma
   *  dönmemesi için (order → track geçişi replace ile yapılır). */
  replace: (r: Route) => void;
  back: () => void;
};
