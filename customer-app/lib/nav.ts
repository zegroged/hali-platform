export type Route =
  | { name: "home" }
  | { name: "profile"; id: string }
  | { name: "order"; id: string; businessName: string }
  | { name: "track"; code?: string };

export type Nav = {
  go: (r: Route) => void;
  back: () => void;
};
