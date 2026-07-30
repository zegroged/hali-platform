"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { MapMarker } from "@/components/LiveMap";
import EmptyState from "@/components/EmptyState";
import { IconMapPin } from "@/components/icons";

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

  // Haritaya yalnız TAZE konum (≤5 dk) — listede "çevrimdışı" yazan şoförün
  // günler önceki konumunu canlıymış gibi basmayalım (B10 ile tutarlı).
  const FRESH_MS = 5 * 60 * 1000;
  const located = drivers.filter(
    (d) =>
      d.isOnShift &&
      d.lat != null &&
      d.lng != null &&
      d.lastSeenAt != null &&
      Date.now() - new Date(d.lastSeenAt).getTime() <= FRESH_MS,
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
        // 2026-07-30: burası tek satır "şoför yok" yazıyordu ve halıcı NEDEN
        // boş olduğunu anlamıyordu (kullanıcının ekran görüntüsü). Rota
        // Geçmişi'nde 2026-07-27'de yapılan "boş ekran sebebini söylesin"
        // düzeltmesinin buraya uygulanmamış hâliydi. Ortak EmptyState kutusu
        // kullanılıyor — panelin diğer boş ekranlarıyla aynı görünsün.
        <EmptyState
          icon={<IconMapPin size={22} />}
          title="Haritada gösterilecek konum yok"
          description={
            drivers.length === 0
              ? "Henüz şoför eklemedin. Şoför ekleyip mesaisini açtırınca konumunu burada canlı görürsün."
              : !drivers.some((d) => d.isOnShift)
                ? "Şoförlerinin hiçbiri şu an mesaide değil. Şoför kendi telefonundan giriş yapıp “Mesaiyi başlat” demeli."
                : "Şoför mesaide ama konum gelmiyor. Telefonu kilitli olabilir, tarayıcı kapanmış olabilir ya da konum izni verilmemiş olabilir."
          }
          actionHref={drivers.length === 0 ? "/panel/soforler" : undefined}
          actionLabel={drivers.length === 0 ? "Şoför ekle" : undefined}
        />
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
            // Telefonda alt alta: 360px'te "ad + ● Çevrimdışı (bağlantı yok)
            // + son: 13:29" tek satıra sığmıyordu (yazı 13px'e çıkınca hiç).
            className="flex flex-col gap-0.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2"
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
