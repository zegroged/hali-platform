"use client";

import { useEffect, useRef, useState } from "react";
import {
  GoogleMap,
  InfoWindowF,
  MarkerF,
  PolylineF,
  useJsApiLoader,
} from "@react-google-maps/api";
import { GOOGLE_MAPS_KEY } from "@/lib/maps";
import { durakEtiketi } from "@/lib/durak";
import LeafletRouteMap from "@/components/LeafletRouteMap";

type Stop = {
  lat: number;
  lng: number;
  durationMin: number;
  address: string | null;
  /** Durağın başlangıç anı (ISO). Haritada "ne zaman" sorusunun cevabı —
   *  2026-08-06'ya kadar yalnız listede vardı, işaretçide yoktu. */
  startedAt?: string;
};
type Props = {
  points: [number, number][];
  stops: Stop[];
  playing: boolean;
  onDone: () => void;
  height?: number;
};

function pinUrl(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="9" fill="${color}" stroke="#ffffff" stroke-width="3"/></svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}
// ÇAPA ŞART: Google özel ikonda varsayılan çapa görselin ALT-ORTASI'dır —
// dairenin merkezi koordinatın 14 px kuzeyine düşer, nokta çizgiden "kayar".
// Daire ikonun çapası merkezi (14,14) olmalı.
const iconCache: Record<string, google.maps.Icon> = {};
function pinIcon(color: string): google.maps.Icon {
  return (iconCache[color] ??= {
    url: pinUrl(color),
    anchor: new google.maps.Point(14, 14),
  });
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function posAt(points: [number, number][], t: number) {
  if (points.length === 1) return { lat: points[0][0], lng: points[0][1] };
  const c = Math.max(0, Math.min(1, t));
  const seg = (points.length - 1) * c;
  const i = Math.min(points.length - 2, Math.floor(seg));
  const f = seg - i;
  return {
    lat: lerp(points[i][0], points[i + 1][0], f),
    lng: lerp(points[i][1], points[i + 1][1], f),
  };
}

export default function GoogleRouteMap({
  points,
  stops,
  playing,
  onDone,
  height = 360,
}: Props) {
  // Açık durak balonu (mobilde dokunmayla açılır).
  const [acikDurak, setAcikDurak] = useState<number | null>(null);
  const { isLoaded, loadError } = useJsApiLoader({
    id: "hali-gmaps",
    googleMapsApiKey: GOOGLE_MAPS_KEY,
  });
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const rafRef = useRef<number | null>(null);

  function fit() {
    const m = mapRef.current;
    if (!m) return;
    if (points.length >= 2) {
      const b = new google.maps.LatLngBounds();
      points.forEach(([la, ln]) => b.extend({ lat: la, lng: ln }));
      m.fitBounds(b, 30);
    } else if (points.length === 1) {
      m.setCenter({ lat: points[0][0], lng: points[0][1] });
      m.setZoom(15);
    }
  }
  function ensureMarker() {
    const m = mapRef.current;
    if (!m || markerRef.current || !points.length) return;
    markerRef.current = new google.maps.Marker({
      position: posAt(points, 0),
      map: m,
      icon: pinIcon("#0d9488"),
      zIndex: 1000,
    });
  }

  const onLoad = (map: google.maps.Map) => {
    mapRef.current = map;
    fit();
    ensureMarker();
  };

  useEffect(() => {
    if (!mapRef.current) return;
    fit();
    if (markerRef.current) markerRef.current.setPosition(posAt(points, 0));
    else ensureMarker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      markerRef.current?.setMap(null);
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!playing || points.length < 2 || !mapRef.current) return;
    ensureMarker();
    const durationMs = Math.max(4000, Math.min(20000, points.length * 600));
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / durationMs);
      markerRef.current?.setPosition(posAt(points, t));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else onDone();
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, points, onDone]);

  // Anahtar geçersiz/kısıtlıysa OSM rota haritasına düş (kilitlenmesin).
  if (loadError) {
    return (
      <LeafletRouteMap
        points={points}
        stops={stops}
        playing={playing}
        onDone={onDone}
        height={height}
      />
    );
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

  const center = points.length
    ? { lat: points[0][0], lng: points[0][1] }
    : { lat: 41.0082, lng: 28.9784 };

  return (
    <GoogleMap
      onLoad={onLoad}
      mapContainerStyle={{ width: "100%", height, borderRadius: 12 }}
      center={center}
      zoom={14}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        // Tek parmakla kaydirma + Ctrl'siz zoom (varsayilan "cooperative"
        // mobilde iki parmak, masaustunde Ctrl+tekerlek istiyordu).
        gestureHandling: "greedy",
      }}
    >
      {points.length >= 2 && (
        <PolylineF
          path={points.map(([la, ln]) => ({ lat: la, lng: ln }))}
          options={{ strokeColor: "#0d9488", strokeWeight: 4, strokeOpacity: 0.8 }}
        />
      )}
      {/* 🔴 `title` FARE İPUCUDUR — mobilde fare yok, dokununca hiçbir şey
          görünmüyordu (kullanıcı bildirdi 2026-08-06). Artık işaretçiye
          BASINCA balon açılıyor: saat · süre · adres. */}
      {stops.map((s, i) => (
        <MarkerF
          key={i}
          position={{ lat: s.lat, lng: s.lng }}
          icon={pinIcon("#dc2626")}
          title={durakEtiketi(s)}
          onClick={() => setAcikDurak(acikDurak === i ? null : i)}
        />
      ))}
      {acikDurak != null && stops[acikDurak] && (
        <InfoWindowF
          position={{ lat: stops[acikDurak].lat, lng: stops[acikDurak].lng }}
          onCloseClick={() => setAcikDurak(null)}
        >
          <div style={{ fontSize: 13, lineHeight: 1.4, maxWidth: 220 }}>
            {durakEtiketi(stops[acikDurak])}
          </div>
        </InfoWindowF>
      )}
    </GoogleMap>
  );
}
