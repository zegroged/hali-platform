"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapProps } from "@/components/mapTypes";

const COLORS: Record<string, string> = {
  driver: "#0d9488",
  pickup: "#dc2626",
  shop: "#2563eb",
  user: "#7c3aed",
};
const EMOJI: Record<string, string> = {
  driver: "🚚",
  pickup: "📍",
  shop: "🏪",
  user: "🧍",
};

function makeIcon(kind: string) {
  const color = COLORS[kind] ?? "#0d9488";
  const emoji = EMOJI[kind] ?? "📍";
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.4);border:2px solid #fff"><span style="transform:rotate(45deg);font-size:14px">${emoji}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export default function LeafletMap({
  markers,
  paths,
  height = 300,
  follow,
}: MapProps) {
  const firstPath = paths?.find((p) => p.points.length)?.points[0];
  const center =
    follow ??
    markers[0] ??
    (firstPath
      ? { lat: firstPath[0], lng: firstPath[1] }
      : { lat: 41.0082, lng: 28.9784 });

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={14}
      style={{ height, width: "100%", borderRadius: 12 }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap &copy; CARTO"
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        detectRetina
      />
      {paths?.map((p, i) => (
        <Polyline
          key={`path-${i}`}
          positions={p.points}
          pathOptions={{ color: p.color ?? "#0d9488", weight: 4, opacity: 0.7 }}
        />
      ))}
      {markers.map((m, i) => (
        <Marker key={i} position={[m.lat, m.lng]} icon={makeIcon(m.kind ?? "shop")}>
          {(m.label || m.href) && (
            <Popup>
              {m.href ? (
                <a href={m.href} style={{ color: "#0d9488", fontWeight: 600 }}>
                  {m.label ?? "Profili gör"}
                </a>
              ) : (
                m.label
              )}
            </Popup>
          )}
        </Marker>
      ))}
      {follow && <Recenter lat={follow.lat} lng={follow.lng} />}
    </MapContainer>
  );
}
