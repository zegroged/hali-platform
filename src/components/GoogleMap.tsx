"use client";

import { useEffect, useState } from "react";
import {
  GoogleMap,
  MarkerF,
  PolylineF,
  useJsApiLoader,
} from "@react-google-maps/api";
import { GOOGLE_MAPS_KEY } from "@/lib/maps";
import LeafletMap from "@/components/LeafletMap";
import type { MapProps } from "@/components/mapTypes";

const COLORS: Record<string, string> = {
  driver: "#0d9488",
  pickup: "#dc2626",
  shop: "#2563eb",
  user: "#7c3aed",
};

function pinUrl(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="9" fill="${color}" stroke="#ffffff" stroke-width="3"/></svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

export default function GoogleMapView({
  markers,
  paths,
  height = 300,
  follow,
}: MapProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "hali-gmaps",
    googleMapsApiKey: GOOGLE_MAPS_KEY,
  });

  // Merkezi bir kez belirle ki canlı yoklamada (5 sn) harita zıplamasın.
  // follow verilmişse onu takip eder (müşteri/şoför izleme); yoksa ilk veriye sabitlenir.
  const [home, setHome] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (home || follow || !markers.length) return;
    setHome({ lat: markers[0].lat, lng: markers[0].lng });
  }, [home, follow, markers]);

  // Anahtar geçerli ama yanlış (referrer/kısıt uyuşmazlığı) olursa Google JS
  // hata döndürür ve isLoaded hep false kalır → sonsuz spinner. Bu durumda
  // OSM/Leaflet'e düş. NOT: erken-return TÜM hook'lardan SONRA olmalı (yoksa
  // loadError anında hook sayısı düşer → "Rendered fewer hooks" çökmesi).
  if (loadError) {
    return <LeafletMap markers={markers} paths={paths} height={height} follow={follow} />;
  }

  if (!isLoaded) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400"
      >
        Harita yükleniyor…
      </div>
    );
  }

  const center =
    follow ??
    home ??
    (markers[0]
      ? { lat: markers[0].lat, lng: markers[0].lng }
      : { lat: 41.0082, lng: 28.9784 });

  // Birden çok işaret varsa haritayı hepsini kapsayacak şekilde aç (arama
  // sonuçları şehir geneline yayılıyor; sabit zoom 14 çoğunu ekran dışında
  // bırakıyordu). Canlı takipte (follow) sabit zoom kalır; yalnız ilk
  // yüklemede çalışır ki kullanıcının pan/zoom'u yoklamalarda ezilmesin.
  const fitOnLoad = (map: google.maps.Map) => {
    if (follow || markers.length < 2) return;
    const bounds = new google.maps.LatLngBounds();
    markers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
    map.fitBounds(bounds, 48);
  };

  return (
    <GoogleMap
      mapContainerStyle={{ width: "100%", height, borderRadius: 12 }}
      center={center}
      zoom={14}
      onLoad={fitOnLoad}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      }}
    >
      {paths?.map((p, i) => (
        <PolylineF
          key={`path-${i}`}
          path={p.points.map(([lat, lng]) => ({ lat, lng }))}
          options={{
            strokeColor: p.color ?? "#0d9488",
            strokeWeight: 4,
            strokeOpacity: 0.85,
          }}
        />
      ))}
      {markers.map((m, i) => (
        <MarkerF
          key={i}
          position={{ lat: m.lat, lng: m.lng }}
          title={m.label}
          icon={pinUrl(COLORS[m.kind ?? "shop"] ?? "#0d9488")}
          onClick={
            m.href
              ? () => {
                  window.location.href = m.href as string;
                }
              : undefined
          }
        />
      ))}
    </GoogleMap>
  );
}
