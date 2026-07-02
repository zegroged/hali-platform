export type MapMarker = {
  lat: number;
  lng: number;
  label?: string;
  kind?: "driver" | "pickup" | "shop" | "user";
  href?: string;
};

export type MapPath = { points: [number, number][]; color?: string };

export type MapProps = {
  markers: MapMarker[];
  paths?: MapPath[];
  height?: number;
  follow?: { lat: number; lng: number };
};
