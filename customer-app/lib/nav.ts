export type Route =
  | { name: "home" }
  | { name: "profile"; id: string }
  | { name: "order"; id: string; businessName: string }
  | { name: "track"; code?: string };

export type Nav = {
  go: (r: Route) => void;
  /** Yığının tepesini değiştirir — sipariş sonrası "geri"nin boşalmış forma
   *  dönmemesi için (order → track geçişi replace ile yapılır). */
  replace: (r: Route) => void;
  back: () => void;
};
