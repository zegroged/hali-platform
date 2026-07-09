"use client";

import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PickMapProps } from "@/components/PickMap";

const ISTANBUL = { lat: 41.0082, lng: 28.9784 };

const pin = L.divIcon({
  className: "",
  html: `<div style="background:#dc2626;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.4);border:2px solid #fff"><span style="transform:rotate(45deg);font-size:14px">📍</span></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

function ClickCatcher({ onPick }: { onPick: PickMapProps["onPick"] }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function LeafletPickMap({
  value,
  onPick,
  height = 260,
}: PickMapProps) {
  const center = value ?? ISTANBUL;
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={value ? 16 : 12}
      style={{ width: "100%", height, borderRadius: 12 }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickCatcher onPick={onPick} />
      {value && (
        <Marker
          position={[value.lat, value.lng]}
          icon={pin}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const p = (e.target as L.Marker).getLatLng();
              onPick({ lat: p.lat, lng: p.lng });
            },
          }}
        />
      )}
    </MapContainer>
  );
}
