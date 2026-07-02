"use client";

import { hasGoogleMaps } from "@/lib/maps";
import LeafletRouteMap from "@/components/LeafletRouteMap";
import GoogleRouteMap from "@/components/GoogleRouteMap";

type Stop = {
  lat: number;
  lng: number;
  durationMin: number;
  address: string | null;
};
type Props = {
  points: [number, number][];
  stops: Stop[];
  playing: boolean;
  onDone: () => void;
  height?: number;
};

// Anahtar varsa Google rota haritası, yoksa Leaflet (ücretsiz OSM). İkisi de akıcı (rAF).
export default function RouteMap(props: Props) {
  return hasGoogleMaps ? (
    <GoogleRouteMap {...props} />
  ) : (
    <LeafletRouteMap {...props} />
  );
}
