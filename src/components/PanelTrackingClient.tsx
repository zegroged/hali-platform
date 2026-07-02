"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { MapMarker } from "@/components/LiveMap";

// Panel haritası: mobilde 360px, geniş ekranda 480px. Placeholder aynı
// sınıfları kullanır ki yükleme geçişinde zıplama olmasın.
const MAP_H = "h-[360px] lg:h-[480px]";

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

type DriverLoc = {
  id: string;
  name: string;
  isOnShift: boolean;
  lat: number | null;
  lng: number | null;
  lastSeenAt: string | null;
  recentPath: [number, number][];
};

export function PanelTrackingClient() {
  const [drivers, setDrivers] = useState<DriverLoc[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      const res = await fetch("/api/panel/drivers/locations", {
        cache: "no-store",
      });
      if (active && res.ok) setDrivers((await res.json()).drivers);
    }
    load();
    const id = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const located = drivers.filter(
    (d) => d.isOnShift && d.lat != null && d.lng != null,
  );
  const markers: MapMarker[] = located.map((d) => ({
    lat: d.lat as number,
    lng: d.lng as number,
    label: d.name,
    kind: "driver",
  }));
  const paths = located
    .filter((d) => d.recentPath && d.recentPath.length > 1)
    .map((d) => ({ points: d.recentPath, color: "#0d9488" }));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Canlı Takip</h1>

      {markers.length > 0 ? (
        <div className={`${MAP_H} [&>div]:!h-full`}>
          <LiveMap markers={markers} paths={paths} />
        </div>
      ) : (
        <div className="flex h-[200px] items-center justify-center rounded-xl bg-slate-100 text-center text-sm text-slate-500">
          Şu an mesaide konum gönderen şoför yok.
        </div>
      )}

      <div className="space-y-2">
        {drivers.map((d) => {
          // Son konum 5 dk'dan eskiyse "çevrimdışı" — bayat konumu canlı gösterme (B10).
          const stale =
            !d.lastSeenAt ||
            Date.now() - new Date(d.lastSeenAt).getTime() > 5 * 60 * 1000;
          return (
          <div
            key={d.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <span className="font-medium text-slate-800">{d.name}</span>
            <span className="text-slate-500">
              {!d.isOnShift ? (
                <span className="text-slate-400">○ Mesai dışı</span>
              ) : stale ? (
                <span className="text-amber-600">● Çevrimdışı (bağlantı yok)</span>
              ) : (
                <span className="text-green-600">● Mesaide</span>
              )}
              {d.lastSeenAt && (
                <span className="ml-2 text-xs text-slate-400">
                  son:{" "}
                  {new Date(d.lastSeenAt).toLocaleTimeString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </span>
          </div>
          );
        })}
      </div>
    </div>
  );
}
