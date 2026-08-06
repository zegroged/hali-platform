"use client";

import { useEffect, useRef } from "react";
import { durakEtiketi } from "@/lib/durak";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Stop = {
  lat: number;
  lng: number;
  durationMin: number;
  address: string | null;
  /** Durağın başlangıç anı (ISO). Haritada "ne zaman" sorusunun cevabı —
   *  2026-08-06'ya kadar yalnız listede vardı, işaretçide yoktu. */
  startedAt?: string;
};

function pinIcon(color: string, emoji: string, size = 30) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.4);border:2px solid #fff"><span style="transform:rotate(45deg);font-size:13px">${emoji}</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size + 2],
  });
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function posAt(points: [number, number][], t: number): L.LatLngTuple {
  if (points.length === 1) return points[0] as L.LatLngTuple;
  const clamped = Math.max(0, Math.min(1, t));
  const seg = (points.length - 1) * clamped;
  const i = Math.min(points.length - 2, Math.floor(seg));
  const f = seg - i;
  return [
    lerp(points[i][0], points[i + 1][0], f),
    lerp(points[i][1], points[i + 1][1], f),
  ];
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(L.latLngBounds(points as L.LatLngTuple[]), {
        padding: [30, 30],
      });
    } else if (points.length === 1) {
      map.setView(points[0] as L.LatLngTuple, 15);
    }
  }, [map, points]);
  return null;
}

function Mover({
  points,
  playing,
  onDone,
}: {
  points: [number, number][];
  playing: boolean;
  onDone: () => void;
}) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const m = L.marker(posAt(points, 0), {
      icon: pinIcon("#0d9488", "🚚"),
      zIndexOffset: 1000,
    }).addTo(map);
    markerRef.current = m;
    return () => {
      m.remove();
      markerRef.current = null;
    };
  }, [map, points]);

  useEffect(() => {
    if (!playing || points.length < 2) return;
    const durationMs = Math.max(4000, Math.min(20000, points.length * 600));
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / durationMs);
      markerRef.current?.setLatLng(posAt(points, t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        onDone();
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, points, onDone]);

  return null;
}

export default function LeafletRouteMap({
  points,
  stops,
  playing,
  onDone,
  height = 360,
}: {
  points: [number, number][];
  stops: Stop[];
  playing: boolean;
  onDone: () => void;
  height?: number;
}) {
  const center = (points[0] ?? [41.0082, 28.9784]) as L.LatLngTuple;
  return (
    <MapContainer
      center={center}
      zoom={14}
      style={{ height, width: "100%", borderRadius: 12 }}
      scrollWheelZoom={false}
      preferCanvas
    >
      <TileLayer
        attribution="&copy; OpenStreetMap &copy; CARTO"
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        detectRetina
      />
      <FitBounds points={points} />
      {points.length >= 2 && (
        <Polyline
          positions={points}
          pathOptions={{ color: "#0d9488", weight: 4, opacity: 0.7 }}
        />
      )}
      {stops.map((s, i) => (
        <Marker key={i} position={[s.lat, s.lng]} icon={pinIcon("#dc2626", "⏸", 26)}>
          <Popup>{durakEtiketi(s)}</Popup>
        </Marker>
      ))}
      <Mover points={points} playing={playing} onDone={onDone} />
    </MapContainer>
  );
}
