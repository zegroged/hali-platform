"use client";

import dynamic from "next/dynamic";
import type { MapMarker } from "@/components/LiveMap";

// Arama haritası: sabit piksel yerine viewport'a duyarlı yükseklik.
// Loading placeholder da aynı sınıfları kullanır ki geçişte zıplama olmasın.
const MAP_H = "h-[50vh] max-h-[560px] min-h-[320px]";

const LiveMap = dynamic(() => import("@/components/LiveMap"), {
  ssr: false,
  loading: () => (
    <div
      className={`flex ${MAP_H} items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500`}
    >
      Harita yükleniyor…
    </div>
  ),
});

type B = { id: string; name: string; lat: number; lng: number; ratingAvg: number };

export function BusinessesMapView({
  businesses,
  center,
}: {
  businesses: B[];
  center?: { lat: number; lng: number };
}) {
  if (!businesses.length && !center) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-xl bg-slate-100 text-center text-sm text-slate-500">
        Bu aramada halıcı yok.
      </div>
    );
  }

  const markers: MapMarker[] = businesses.map((b) => ({
    lat: b.lat,
    lng: b.lng,
    kind: "shop",
    label: `${b.name} · ★${b.ratingAvg.toFixed(1)}`,
    href: `/halici/${b.id}`,
  }));
  if (center) {
    markers.unshift({
      lat: center.lat,
      lng: center.lng,
      kind: "user",
      label: "Konumun",
    });
  }

  return (
    <>
      {!businesses.length && (
        <p className="mb-2 text-sm text-slate-500">
          Bu konuma yakın halıcı bulunamadı — haritada konumun işaretli.
        </p>
      )}
      {/* Harita bileşeni inline piksel yüksekliği bastığı için sarmalayıcı
          responsive yüksekliği !h-full ile içeriye zorlar. */}
      <div className={`${MAP_H} [&>div]:!h-full`}>
        <LiveMap markers={markers} follow={center} />
      </div>
    </>
  );
}
