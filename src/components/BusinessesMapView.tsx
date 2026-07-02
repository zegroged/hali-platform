"use client";

import dynamic from "next/dynamic";
import type { MapMarker } from "@/components/LiveMap";

const LiveMap = dynamic(() => import("@/components/LiveMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[440px] items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">
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
      <div className="flex h-[200px] items-center justify-center rounded-xl bg-slate-100 text-center text-sm text-slate-400">
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
      <LiveMap markers={markers} follow={center} height={440} />
    </>
  );
}
