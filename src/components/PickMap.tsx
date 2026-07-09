"use client";

import { hasGoogleMaps } from "@/lib/maps";
import GooglePickMap from "@/components/GooglePickMap";
import LeafletPickMap from "@/components/LeafletPickMap";

export type PickMapProps = {
  value: { lat: number; lng: number } | null;
  onPick: (c: { lat: number; lng: number }) => void;
  height?: number;
};

/** Tıklanarak konum seçilen harita — Google anahtarı varsa Google, yoksa OSM. */
export default function PickMap(props: PickMapProps) {
  return hasGoogleMaps ? (
    <GooglePickMap {...props} />
  ) : (
    <LeafletPickMap {...props} />
  );
}
