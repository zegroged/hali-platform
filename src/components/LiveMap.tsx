"use client";

import { hasGoogleMaps } from "@/lib/maps";
import LeafletMap from "@/components/LeafletMap";
import GoogleMapView from "@/components/GoogleMap";
import type { MapProps, MapMarker, MapPath } from "@/components/mapTypes";

export type { MapMarker, MapPath };

// Anahtar varsa Google Maps, yoksa ücretsiz OSM (Leaflet). Tüm harita tüketicileri bunu kullanır.
export default function LiveMap(props: MapProps) {
  return hasGoogleMaps ? <GoogleMapView {...props} /> : <LeafletMap {...props} />;
}
